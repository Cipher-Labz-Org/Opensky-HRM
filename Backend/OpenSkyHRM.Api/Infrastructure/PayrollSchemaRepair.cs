namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Ensures payroll catalog columns exist when SQL-only / swallowed MigrateAsync
/// left tenant DBs behind. Missing IsEpfApplicable / IsEtfApplicable makes
/// GET /api/payroll/components return HTTP 500, which the UI shows as an empty catalog.
/// </summary>
public static class PayrollSchemaRepair
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
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "Category" text NOT NULL DEFAULT '';
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "FormulaExpression" text;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "DependsOnComponentCode" text;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEmployerContribution" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "SortOrder" integer NOT NULL DEFAULT 0;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEpfApplicable" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEtfApplicable" boolean NOT NULL DEFAULT FALSE;

                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = "IsTaxable",
                    "IsEtfApplicable" = "IsTaxable"
                WHERE NOT "IsDeleted"
                  AND "IsEpfApplicable" = FALSE
                  AND "IsEtfApplicable" = FALSE
                  AND "IsTaxable" = TRUE;

                UPDATE "CompensationComponents"
                SET "IsEtfApplicable" = TRUE
                WHERE NOT "IsDeleted"
                  AND "IsEpfApplicable" = TRUE
                  AND "IsEtfApplicable" = FALSE
                  AND "Type" = 'Earning';
                """;
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine("INFO: Payroll compensation-component schema columns verified.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Payroll schema repair skipped: {ex.Message}");
        }
    }
}
