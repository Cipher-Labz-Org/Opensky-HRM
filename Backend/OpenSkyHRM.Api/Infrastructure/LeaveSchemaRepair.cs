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

                -- Part hours (e.g. 1.5) need numeric; widening is a no-op once applied.
                ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" TYPE numeric;
                ALTER TABLE "LeaveTypes" ALTER COLUMN "MinHours" TYPE numeric;
                ALTER TABLE "LeaveTypes" ALTER COLUMN "MaxHours" TYPE numeric;
                ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" SET DEFAULT 3;
                ALTER TABLE "LeaveRequests" ALTER COLUMN "ShortLeaveHours" TYPE numeric;

                ALTER TABLE "LeaveBalances" ADD COLUMN IF NOT EXISTS "IsImported" boolean NOT NULL DEFAULT FALSE;

                UPDATE "LeaveBalances" AS lb
                SET "IsImported" = TRUE
                WHERE lb."IsImported" = FALSE
                  AND (
                    lb."Used" <> 0
                    OR lb."CarriedForward" <> 0
                    OR lb."BroughtForwardDays" <> 0
                    OR EXISTS (
                        SELECT 1 FROM "LeaveTypes" lt
                        WHERE lt."Id" = lb."LeaveTypeId"
                          AND (
                            lt."Code" IN ('LT-COFF', 'LT-FSG')
                            OR lt."Name" ILIKE '%compensatory%'
                            OR lt."Name" ILIKE '%special grant%'
                            OR lt."Name" ILIKE '%freelancer%'
                          )
                      )
                  );
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
