using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

var builder = WebApplication.CreateBuilder(args);

// --- Layer DI Registration ---
builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddApplication();

// --- Controllers ---
builder.Services.AddControllers();

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
    builder.Services.AddHangfire(config =>
        config.UsePostgreSqlStorage(options =>
            options.UseNpgsqlConnection(hangfireConn)));
    builder.Services.AddHangfireServer();
}

// --- CORS (allow Next.js frontend) ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
                    ?? new[] { "http://localhost:3000" })
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// --- Migrate & Seed on startup (development only) ---
if (app.Environment.IsDevelopment() && dbAvailable)
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        await DbSeeder.SeedAsync(app.Services);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Database migration/seed failed: {ex.Message}");
    }
}

// --- Middleware Pipeline ---
app.UseCors("Frontend");

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

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.PayrollBatchExportJob>(
            "payroll-batch-export",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(2, 0));

        RecurringJob.AddOrUpdate<OpenSkyHRM.Application.Jobs.ReportGenerationJob>(
            "report-generation",
            job => job.ExecuteAsync(),
            Hangfire.Cron.Daily(3, 0));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Hangfire setup failed: {ex.Message}");
    }
}

app.MapControllers();

app.MapGet("/", () => Results.Redirect("/swagger"));

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow, database = dbAvailable }));

app.Run();
