using System.Text.Json;
using Npgsql;

static string? ReadConn(string path, string key)
{
    if (!File.Exists(path)) return null;
    using var doc = JsonDocument.Parse(File.ReadAllText(path), new JsonDocumentOptions { AllowTrailingCommas = true });
    if (doc.RootElement.TryGetProperty("ConnectionStrings", out var cs)
        && cs.TryGetProperty(key, out var val))
        return val.GetString();
    return null;
}

var baseDir = args.Length > 0
    ? args[0]
    : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "OpenSkyHRM.Api"));

var databases = new List<string>();
foreach (var file in new[] { "appsettings.Development.json", "appsettings.json" })
{
    var conn = ReadConn(Path.Combine(baseDir, file), "DefaultConnection");
    if (!string.IsNullOrWhiteSpace(conn) && !databases.Contains(conn))
        databases.Add(conn);
}

// Also probe other local databases that may hold tenant data.
var probeHost = databases.FirstOrDefault()?.Split(';')
    .FirstOrDefault(p => p.StartsWith("Host=", StringComparison.OrdinalIgnoreCase))
    ?? "Host=localhost";
var probeUser = databases.FirstOrDefault()?.Split(';')
    .FirstOrDefault(p => p.StartsWith("Username=", StringComparison.OrdinalIgnoreCase))
    ?? "Username=postgres";
var probePass = databases.FirstOrDefault()?.Split(';')
    .FirstOrDefault(p => p.StartsWith("Password=", StringComparison.OrdinalIgnoreCase))
    ?? "Password=postgres";
var probePort = databases.FirstOrDefault()?.Split(';')
    .FirstOrDefault(p => p.StartsWith("Port=", StringComparison.OrdinalIgnoreCase))
    ?? "Port=5432";

foreach (var dbName in new[] { "stagecafe", "openskylabz_erp" })
{
    var conn = $"{probeHost};{probePort};Database={dbName};{probeUser};{probePass}";
    if (!databases.Contains(conn))
        databases.Add(conn);
}

// Only trace the primary dev database unless overridden.
if (args.Length == 0)
{
    databases = databases.Where(c => c.Contains("openskyhrm_dev", StringComparison.OrdinalIgnoreCase)).Take(1).ToList();
}

if (databases.Count == 0)
{
    databases.Add("Host=localhost;Port=5432;Database=openskyhrm_dev;Username=postgres;Password=postgres");
}

foreach (var connStr in databases)
{
    Console.WriteLine();
    Console.WriteLine("################################################################");
    Console.WriteLine($"# Connection: {MaskPassword(connStr)}");
    Console.WriteLine("################################################################");

    try
    {
        await RunDiagnostics(connStr);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"ERROR: {ex.Message}");
    }
}

static string MaskPassword(string connStr) =>
    System.Text.RegularExpressions.Regex.Replace(connStr, @"Password=[^;]*", "Password=***", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

static async Task RunDiagnostics(string connStr)
{
await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

static async Task PrintSection(NpgsqlConnection conn, string title, string sql)
{
    Console.WriteLine();
    Console.WriteLine($"=== {title} ===");
    try
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        var cols = Enumerable.Range(0, reader.FieldCount).Select(reader.GetName).ToArray();
        Console.WriteLine(string.Join(" | ", cols));
        Console.WriteLine(new string('-', Math.Min(120, cols.Sum(c => c.Length + 3))));
        var rows = 0;
        while (await reader.ReadAsync())
        {
            var vals = Enumerable.Range(0, reader.FieldCount)
                .Select(i => reader.IsDBNull(i) ? "NULL" : reader.GetValue(i)?.ToString() ?? "")
                .ToArray();
            Console.WriteLine(string.Join(" | ", vals));
            if (++rows >= 30) break;
        }
        if (rows == 0) Console.WriteLine("(no rows)");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"ERROR: {ex.Message}");
    }
}

await PrintSection(conn, "Deleted Biometric Attendance since Aug 4", """
    SELECT DATE("Date") AS day, COUNT(*) AS cnt
    FROM "AttendanceRecords"
    WHERE "IsDeleted" AND "Source" = 'Biometric' AND "Date" >= '2026-08-04'
    GROUP BY 1 ORDER BY 1
    """);

await PrintSection(conn, "Manual import history", """
    SELECT b."FileName", b."ImportedAt", b."TotalRecords", b."SuccessCount", b."FailCount", b."Status"
    FROM "PunchImportBatches" b
    ORDER BY b."ImportedAt" DESC
    LIMIT 10
    """);

await PrintSection(conn, "Any Biometric Attendance ever", """
    SELECT DATE("Date") AS day, COUNT(*) AS cnt
    FROM "AttendanceRecords"
    WHERE "Source" = 'Biometric'
    GROUP BY 1 ORDER BY 1 DESC
    LIMIT 10
    """);

await PrintSection(conn, "Attendance Aug 4 specifically", """
    SELECT "Id", DATE("Date") AS day, "Source", "Status", "PunchIn", "PunchOut"
    FROM "AttendanceRecords"
    WHERE NOT "IsDeleted" AND "Date" >= '2026-08-04' AND "Date" < '2026-08-05'
    LIMIT 15
    """);

await PrintSection(conn, "List databases on server", """
    SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname
    """);

await PrintSection(conn, "All Attendance (any source, top 20 by date)", """
    SELECT DATE("Date") AS day, "Source", COUNT(*) AS cnt
    FROM "AttendanceRecords"
    WHERE NOT "IsDeleted"
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2
    LIMIT 20
    """);

await PrintSection(conn, "Database name check", """
    SELECT current_database() AS db
    """);

await PrintSection(conn, "BiometricDevices", """
    SELECT "Name", "SerialNumber", "LastSyncAt", "IsActive"
    FROM "BiometricDevices"
    WHERE NOT "IsDeleted"
    ORDER BY "LastSyncAt" DESC NULLS LAST
    """);

await PrintSection(conn, "Recent Raw Events", """
    SELECT "ReceivedAtUtc", "ParseStatus", COALESCE("ParseError", '') AS "ParseError",
           LEFT("Payload", 80) AS "PayloadPreview"
    FROM "BiometricRawEvents"
    ORDER BY "ReceivedAtUtc" DESC
    LIMIT 15
    """);

await PrintSection(conn, "Raw Events By Day (since Aug 4)", """
    SELECT DATE("ReceivedAtUtc") AS day, COUNT(*) AS cnt,
           SUM(CASE WHEN "ParseStatus" = 'Parsed' THEN 1 ELSE 0 END) AS parsed
    FROM "BiometricRawEvents"
    WHERE "ReceivedAtUtc" >= '2026-08-04'
    GROUP BY 1 ORDER BY 1
    """);

await PrintSection(conn, "Recent Punch Events", """
    SELECT "PunchAtUtc", "DeviceUserId", "ProcessedToAttendance", "PunchState"
    FROM "BiometricPunchEvents"
    ORDER BY "PunchAtUtc" DESC
    LIMIT 15
    """);

await PrintSection(conn, "Punches By Day (since Aug 4)", """
    SELECT DATE("PunchAtUtc") AS day, COUNT(*) AS cnt,
           SUM(CASE WHEN "ProcessedToAttendance" THEN 1 ELSE 0 END) AS processed
    FROM "BiometricPunchEvents"
    WHERE "PunchAtUtc" >= '2026-08-04'
    GROUP BY 1 ORDER BY 1
    """);

await PrintSection(conn, "Unprocessed Punch Count", """
    SELECT COUNT(*) AS unprocessed FROM "BiometricPunchEvents" WHERE NOT "ProcessedToAttendance"
    """);

await PrintSection(conn, "Attendance By Day (Biometric, since Aug 4)", """
    SELECT DATE("Date") AS day, COUNT(*) AS cnt
    FROM "AttendanceRecords"
    WHERE "Source" = 'Biometric' AND NOT "IsDeleted" AND "Date" >= '2026-08-04'
    GROUP BY 1 ORDER BY 1
    """);

await PrintSection(conn, "Unmapped DeviceUserIds (punches without matching EmployeeCode)", """
    SELECT DISTINCT p."DeviceUserId", COUNT(*) AS punch_count
    FROM "BiometricPunchEvents" p
    LEFT JOIN "Employees" e ON e."EmployeeCode" = p."DeviceUserId" AND NOT e."IsDeleted"
    WHERE e."Id" IS NULL AND p."PunchAtUtc" >= '2026-08-04'
    GROUP BY p."DeviceUserId"
    ORDER BY punch_count DESC
    LIMIT 20
    """);

await PrintSection(conn, "Pipeline break-point (computed)", """
    SELECT
      CASE
        WHEN (SELECT COUNT(*) FROM "BiometricRawEvents" WHERE "ReceivedAtUtc" >= '2026-08-04') = 0
          THEN 'ingestion: no ADMS webhook data since Aug 4'
        WHEN (SELECT COUNT(*) FROM "BiometricPunchEvents" WHERE "PunchAtUtc" >= '2026-08-04') = 0
          THEN 'parse: raw events exist but no punches parsed'
        WHEN (SELECT COUNT(*) FROM "BiometricPunchEvents" WHERE NOT "ProcessedToAttendance") > 0
          THEN 'processing: unprocessed punch backlog'
        WHEN (SELECT COUNT(*) FROM "AttendanceRecords" WHERE "Source" = 'Biometric' AND NOT "IsDeleted" AND "Date" >= '2026-08-04') = 0
          THEN 'mapping: punches processed but no biometric attendance'
        ELSE 'healthy: biometric attendance exists since Aug 4'
      END AS diagnosis
    """);
}
