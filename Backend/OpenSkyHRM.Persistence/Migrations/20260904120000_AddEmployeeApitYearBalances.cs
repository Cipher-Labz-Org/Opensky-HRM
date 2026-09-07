using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260904120000_AddEmployeeApitYearBalances")]
    public partial class AddEmployeeApitYearBalances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IF NOT EXISTS: live tenants may already have these from PayrollSchemaRepair.
            // A non-idempotent AddColumn/CreateTable would fail MigrateAsync and skip later migrations.
            migrationBuilder.Sql(
                """
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
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TABLE IF EXISTS "EmployeeApitYearBalances";
                ALTER TABLE "PayStatements" DROP COLUMN IF EXISTS "ApitTaxable";
                ALTER TABLE "Employees" DROP COLUMN IF EXISTS "ApitTaxMode";
                """);
        }
    }
}
