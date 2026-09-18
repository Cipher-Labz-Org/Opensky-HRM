namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Ensures payroll catalog and batch columns exist when SQL-only / swallowed MigrateAsync
/// left tenant DBs behind. Missing IsEpfApplicable / IsEtfApplicable makes
/// GET /api/payroll/components return HTTP 500. Missing batch review/period columns
/// make GET /api/payroll/batches return HTTP 500 on the payroll dashboard.
/// Adds EPF/ETF columns if missing; does not overwrite user-chosen flags after they exist.
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
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "RoundResult" boolean NOT NULL DEFAULT FALSE;

                -- Transport allowance is taxable pay, not EPF/ETF wage.
                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = FALSE, "IsEtfApplicable" = FALSE
                WHERE UPPER("Code") = 'TA';

                ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ApitTaxMode" character varying(20);
                ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "IsCashPayment" boolean NOT NULL DEFAULT FALSE;
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

                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ProcessType" character varying(30) NOT NULL DEFAULT 'Salary';
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "SelectedEmployeeIds" text;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "Notes" character varying(1000);
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "TotalDeductions" numeric(18,2) NOT NULL DEFAULT 0;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "TotalEmployerCost" numeric(18,2) NOT NULL DEFAULT 0;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "EffectiveFrom" timestamp without time zone NOT NULL DEFAULT TIMESTAMP '2000-01-01';
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "EffectiveTo" timestamp without time zone;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ReviewedBy" character varying(200);
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ReviewedAt" timestamp without time zone;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ApprovedBy" character varying(200);
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp without time zone;

                UPDATE "PayrollBatches"
                SET "EffectiveFrom" = make_date("Year", "Month", 1),
                    "EffectiveTo" = (make_date("Year", "Month", 1) + interval '1 month' - interval '1 day')::timestamp
                WHERE "EffectiveFrom" = TIMESTAMP '2000-01-01';

                CREATE TABLE IF NOT EXISTS "PayrollBatchAttendanceSnapshots" (
                    "Id" uuid NOT NULL,
                    "BatchId" uuid NOT NULL,
                    "EmployeeId" uuid NOT NULL,
                    "ApprovedOtHours" numeric(18,2) NOT NULL DEFAULT 0,
                    "OtAmount" numeric(18,2) NOT NULL DEFAULT 0,
                    "AttendanceNopayDays" integer NOT NULL DEFAULT 0,
                    "LeaveNopayDays" integer NOT NULL DEFAULT 0,
                    "TotalNopayDays" integer NOT NULL DEFAULT 0,
                    "PoyaDaysWorked" numeric(18,2) NOT NULL DEFAULT 0,
                    "OtApproved" boolean NOT NULL DEFAULT FALSE,
                    "OtOutdated" boolean NOT NULL DEFAULT FALSE,
                    "ImportedAt" timestamp without time zone NOT NULL DEFAULT NOW(),
                    "CreatedAt" timestamp without time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp without time zone,
                    "IsDeleted" boolean NOT NULL DEFAULT FALSE,
                    CONSTRAINT "PK_PayrollBatchAttendanceSnapshots" PRIMARY KEY ("Id")
                );
                ALTER TABLE "PayrollBatchAttendanceSnapshots" ADD COLUMN IF NOT EXISTS "PoyaDaysWorked" numeric(18,2) NOT NULL DEFAULT 0;
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_PayrollBatchAttendanceSnapshots_BatchId_EmployeeId"
                    ON "PayrollBatchAttendanceSnapshots" ("BatchId", "EmployeeId");
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
