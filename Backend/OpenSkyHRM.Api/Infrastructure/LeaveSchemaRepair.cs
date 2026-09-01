namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Ensures half-day / short-leave columns exist when SQL-only leave migrations
/// did not apply (MigrateAsync is swallowed on failure). Missing columns make
/// GET /api/leave/requests return HTTP 500.
/// </summary>
public static class LeaveSchemaRepair
{
    public static async Task EnsureCompatibleSchemaAsync(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        try
        {
            await using var conn = new Npgsql.NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "AllowHalfDay" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "AllowShortLeave" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "ShortLeaveHours" integer NOT NULL DEFAULT 3;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MinDays" numeric NULL;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MaxDays" numeric NULL;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MinHours" integer NULL;
                ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MaxHours" integer NULL;

                ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "DurationKind" character varying(20) NOT NULL DEFAULT 'FullDay';
                ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "HalfDayPeriod" character varying(20) NULL;
                ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "ShortLeaveHours" integer NULL;
                """;
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine("INFO: Leave schema columns verified.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Leave schema repair skipped: {ex.Message}");
        }
    }
}
