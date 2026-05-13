using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Auditing;
using OpenSkyHRM.Persistence.Seeders;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Optional per-machine overrides (e.g. local MailHog SMTP). File is gitignored — copy from appsettings.Local.example.json.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

static bool IsSafePgIdentifier(string? name)
{
    if (string.IsNullOrWhiteSpace(name))
        return false;

    // Conservative: only allow characters commonly used in DB names.
    // Prevents injection since we must interpolate the identifier in CREATE DATABASE.
    foreach (var ch in name)
    {
        if (!(char.IsLetterOrDigit(ch) || ch == '_'))
            return false;
    }
    return true;
}

static async Task EnsureDatabaseExistsAsync(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString))
        return;

    var csb = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
    var targetDb = csb.Database;

    if (!IsSafePgIdentifier(targetDb))
        throw new InvalidOperationException($"Unsafe or missing database name in connection string: '{targetDb}'");

    // Connect to the maintenance DB to create/check the target DB.
    csb.Database = "postgres";

    await using var conn = new Npgsql.NpgsqlConnection(csb.ConnectionString);
    await conn.OpenAsync();

    await using (var existsCmd = conn.CreateCommand())
    {
        existsCmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @db";
        existsCmd.Parameters.AddWithValue("db", targetDb!);

        var exists = await existsCmd.ExecuteScalarAsync();
        if (exists == null)
        {
            await using var createCmd = conn.CreateCommand();
            createCmd.CommandText = $@"CREATE DATABASE ""{targetDb}""";
            await createCmd.ExecuteNonQueryAsync();
        }
    }
}

// --- Layer DI Registration ---
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentAuditUser, HttpContextCurrentAuditUser>();
builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddApplication();

// --- JWT Authentication ---
var jwtKey = builder.Configuration["Jwt:Key"] ?? "OpenSkyHRM-Default-Key-256bit-ChangeMe!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "OpenSkyHRM";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "OpenSkyHRM";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.FromMinutes(1)
    };
});
builder.Services.AddAuthorization();

// --- Controllers ---
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new ApiDateTimeJsonConverter()));

// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "OpenSkyHRM API",
        Version = "v1",
        Description = "Enterprise HRIS REST API"
    });
});

// --- Test DB connectivity before registering Hangfire ---
var dbAvailable = false;
var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
try
{
    var testConnBuilder = new Npgsql.NpgsqlConnectionStringBuilder(connStr);
    testConnBuilder.Database = "postgres";
    using var testConn = new Npgsql.NpgsqlConnection(testConnBuilder.ConnectionString);
    testConn.Open();
    testConn.Close();
    dbAvailable = true;
}
catch (Exception ex)
{
    Console.WriteLine($"WARNING: Cannot connect to PostgreSQL: {ex.Message}");
    Console.WriteLine("The API will start without database and Hangfire. Only Swagger UI will be functional.");
}

if (dbAvailable)
{
    var hangfireConn = builder.Configuration.GetConnectionString("HangfireConnection") ?? connStr;
    try
    {
        builder.Services.AddHangfire(config =>
            config.UsePostgreSqlStorage(hangfireConn, new PostgreSqlStorageOptions
            {
                PrepareSchemaIfNecessary = true,
                SchemaName = "hangfire"
            }));
        builder.Services.AddHangfireServer();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Hangfire registration failed: {ex.Message}");
        Console.WriteLine("The API will start without Hangfire background processing.");
    }
}

// --- CORS (allow Next.js frontend) ---
// Next.js picks the next free port (3000, 3001, 3002, …) when the default is busy — include a dev port range.
var localNextDevOrigins = Enumerable.Range(0, 11)
    .SelectMany(p =>
    {
        var port = 3000 + p;
        return new[] { $"http://localhost:{port}", $"http://127.0.0.1:{port}" };
    })
    .ToArray();

var configuredCors = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
string[] corsOrigins;
if (configuredCors is { Length: > 0 })
{
    corsOrigins = builder.Environment.IsDevelopment()
        ? configuredCors.Concat(localNextDevOrigins).Distinct(StringComparer.OrdinalIgnoreCase).ToArray()
        : configuredCors;
}
else
{
    corsOrigins = localNextDevOrigins;
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// Helpful when interview/offer/recruitment application emails show SkippedNotConfigured in Email delivery log.
{
    var cfg = builder.Configuration;
    if (!OutboundEmailConfiguration.IsEmailProviderConfigured(cfg))
    {
        Console.WriteLine(
            "WARNING: Outbound email is not configured. Set SendGrid:ApiKey (dotnet user-secrets set SendGrid:ApiKey <key>) or SENDGRID_API_KEY / SendGrid__ApiKey, " +
            "or set Smtp:Host (and credentials if required). For local Mailpit/MailHog, copy appsettings.Local.example.json to appsettings.Local.json. " +
            "Until configured, transactional emails are skipped with status SkippedNotConfigured (see OutboundEmailLogs). " +
            "Same settings apply to leave confirmations, recruitment inbox mail, interviews, and offers.");
    }
}

// Apply pending EF migrations whenever PostgreSQL is reachable (adds licensing tables, etc.).
if (dbAvailable)
{
    try
    {
        var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection");
        var hangfireConn = builder.Configuration.GetConnectionString("HangfireConnection") ?? defaultConn;
        await EnsureDatabaseExistsAsync(defaultConn);
        await EnsureDatabaseExistsAsync(hangfireConn);

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        // Repair corrupted Hangfire schema from partial installs so the auto-installer can start fresh.
        try
        {
            await using var hfConn = new Npgsql.NpgsqlConnection(hangfireConn);
            await hfConn.OpenAsync();
            await using var cmd = hfConn.CreateCommand();
            cmd.CommandText = @"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'hangfire')
                       AND NOT EXISTS (
                           SELECT 1 FROM information_schema.tables
                           WHERE table_schema = 'hangfire' AND table_name = 'schema'
                       )
                    THEN
                        DROP SCHEMA hangfire CASCADE;
                    END IF;
                END $$;";
            await cmd.ExecuteNonQueryAsync();
        }
        catch { }

        // Hangfire.PostgreSql can retry forever on a half-migrated schema (42701: column "updatecount"
        // on hangfire.lock already exists), which prevents the host from finishing startup — no HTTP listener.
        if (app.Configuration.GetValue<bool>("Hangfire:ResetSchemaOnStartup"))
        {
            try
            {
                await using var hfResetConn = new Npgsql.NpgsqlConnection(hangfireConn);
                await hfResetConn.OpenAsync();
                await using var resetCmd = hfResetConn.CreateCommand();
                resetCmd.CommandText = "DROP SCHEMA IF EXISTS hangfire CASCADE;";
                await resetCmd.ExecuteNonQueryAsync();
            }
            catch { /* non-fatal */ }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Database migration failed: {ex.Message}");
    }
}

// Demo/admin seed data (development only)
if (app.Environment.IsDevelopment() && dbAvailable)
{
    try
    {
        await DbSeeder.SeedAsync(app.Services);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Database seeding failed: {ex.Message}");
    }
}

// --- Licensing catalog & default entitlements (all environments; idempotent) ---
if (dbAvailable)
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await LicensingSeeder.EnsureAsync(db);
        await OpenSkyHRM.Persistence.Seeders.EmployeeLifecycleTemplateSeeder.EnsureAsync(db);
        await db.SaveChangesAsync();
        await OpenSkyHRM.Persistence.Seeders.LeaveSeeder.EnsureCatalogLeaveTypesAsync(db);
        await OpenSkyHRM.Persistence.Seeders.LeaveSeeder.PatchShopOfficeLeaveRulesAsync(db);
        await OpenSkyHRM.Persistence.Seeders.LeaveSeeder.PatchCasualLeaveMonthlyEveryYearAsync(db);
        await OpenSkyHRM.Persistence.Seeders.LeaveSeeder.EnsureShopOfficeSickLeaveRuleAsync(db);

        // Dev safety: ensure there is always at least one usable admin after resets.
        // This does not overwrite existing users; it only bootstraps if no active ADMIN user exists.
        if (app.Environment.IsDevelopment())
        {
            var bootstrapPassword = builder.Configuration["CustomerReset:BootstrapAdminPassword"] ?? "Admin@123";
            await AdminBootstrapSeeder.EnsureAsync(db, adminPassword: bootstrapPassword);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Licensing defaults could not be ensured: {ex.Message}");
    }
}

// Birthday digest: run once at startup so the bell is not empty until Hangfire's daily cron.
// In Development, optional seed nudges EMP-0001 into the 7-day window when no one matches (see appsettings.Development.json).
if (dbAvailable)
{
    try
    {
        using var birthdayScope = app.Services.CreateScope();
        var birthdayDb = birthdayScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var utc = DateTime.UtcNow;
        var devSample = app.Environment.IsDevelopment()
                        && app.Configuration.GetValue<bool>("Birthdays:EnsureDevSampleInWindowOnStartup", false);
        if (devSample)
            await BirthdayDigestDevDataSeeder.EnsureSampleBirthdayInWindowIfEmptyAsync(birthdayDb, utc);

        var digest = birthdayScope.ServiceProvider.GetRequiredService<IEmployeeBirthdayDigestReminderService>();
        await digest.ProcessForUtcDateAsync(utc);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Birthday digest on startup failed: {ex.Message}");
    }
}

// --- Middleware Pipeline ---
var wwwrootPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
Directory.CreateDirectory(wwwrootPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootPath),
    RequestPath = ""
});
app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "OpenSkyHRM API v1");
    options.RoutePrefix = "swagger";
});

if (dbAvailable)
{
    try
    {
        app.UseHangfireDashboard("/hangfire");

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.AttendanceReconciliationJob>(
            "attendance-reconciliation",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(1, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.LeaveAccrualJob>(
            "leave-accrual",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(1, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.PayrollBatchExportJob>(
            "payroll-batch-export",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(2, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.ReportGenerationJob>(
            "report-generation",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(3, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.AnalyticsSnapshotRefreshJob>(
            "analytics-snapshot-refresh",
            job => job.ExecuteAsync(CancellationToken.None),
            Hangfire.Cron.Daily(4, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.TrainingDueReminderJob>(
            "training-overdue-reminders",
            job => job.ExecuteAsync(CancellationToken.None),
            Hangfire.Cron.Daily(5, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.DrugTransportLicenseExpiryReminderJob>(
            "drug-transport-license-expiry-reminders",
            job => job.ExecuteAsync(CancellationToken.None),
            Hangfire.Cron.Daily(5, 30));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.EmployeeBirthdayDigestReminderJob>(
            "employee-birthday-digest",
            job => job.ExecuteAsync(CancellationToken.None),
            Hangfire.Cron.Daily(6, 0));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Hangfire setup failed: {ex.Message}");
    }
}

app.MapControllers();

// Do not add minimal API routes for endpoints already on LeaveController — duplicate paths
// break Swashbuckle and return 500 for /swagger/v1/swagger.json.

app.MapGet("/", () => Results.Redirect("/swagger"));

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow, database = dbAvailable }));

app.Run();

/// <summary>
/// Serializes UTC instants with a Z suffix; business-local wall times (Unspecified / Local) without Z so clients do not misread them as UTC.
/// </summary>
public sealed class ApiDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var dt = reader.GetDateTime();
        // Preserve Unspecified for round-trip with legacy timestamp columns (wall time).
        return dt;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        const string localFmt = "yyyy-MM-dd'T'HH:mm:ss.fff";
        if (value.Kind == DateTimeKind.Utc)
        {
            writer.WriteStringValue(
                value.ToUniversalTime().ToString(localFmt, CultureInfo.InvariantCulture) + "Z");
            return;
        }

        writer.WriteStringValue(value.ToString(localFmt, CultureInfo.InvariantCulture));
    }
}
