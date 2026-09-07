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

                -- Phase 1: Earning components marked taxable should default to EPF+ETF applicable
                -- when both flags are still at their default FALSE values.
                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = TRUE,
                    "IsEtfApplicable" = TRUE
                WHERE NOT "IsDeleted"
                  AND "IsEpfApplicable" = FALSE
                  AND "IsEtfApplicable" = FALSE
                  AND "IsTaxable" = TRUE
                  AND "Type" = 'Earning';

                -- Phase 2: Earning components with EPF but missing ETF (old single-select UI bug)
                UPDATE "CompensationComponents"
                SET "IsEtfApplicable" = TRUE
                WHERE NOT "IsDeleted"
                  AND "IsEpfApplicable" = TRUE
                  AND "IsEtfApplicable" = FALSE
                  AND "Type" = 'Earning';

                -- Phase 3: Known default catalog codes that must always have EPF+ETF
                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = TRUE,
                    "IsEtfApplicable" = TRUE
                WHERE NOT "IsDeleted"
                  AND "Type" = 'Earning'
                  AND "Code" IN ('BASIC','TA','HOUSING','ATTEND','OT','COMMISSION','INCENTIVE','BONUS','POYA_DAY_PAY')
                  AND ("IsEpfApplicable" = FALSE OR "IsEtfApplicable" = FALSE);

                ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ApitTaxMode" character varying(20);
                ALTER TABLE "PayStatements" ADD COLUMN IF NOT EXISTS "ApitTaxable" numeric(18,2) NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS "EmployeeApitYearBalances" (
                    "Id" uuid NOT NULL,
                    "EmployeeId" uuid NOT NULL,
                    "TaxYearStartYear" integer NOT NULL,
                    "CumulativeTaxable" numeric(18,2) NOT NULL,
                    "CumulativeApit" numeric(18,2) NOT NULL,
                    "CreatedAt" timestamp without time zone NOT NULL,
                    "UpdatedAt" timestamp without time zone,
                    "IsDeleted" boolean NOT NULL,
                    "CreatedBy" text,
                    "UpdatedBy" text,
                    CONSTRAINT "PK_EmployeeApitYearBalances" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_EmployeeApitYearBalances_Employees_EmployeeId"
                        FOREIGN KEY ("EmployeeId") REFERENCES "Employees" ("Id") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_EmployeeApitYearBalances_EmployeeId_TaxYearStartYear"
                    ON "EmployeeApitYearBalances" ("EmployeeId", "TaxYearStartYear")
                    WHERE "IsDeleted" = FALSE;
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
