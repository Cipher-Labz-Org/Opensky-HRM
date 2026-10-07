using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeEvaluations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "RosterTemplates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            // IF NOT EXISTS: 20260813050000_AddRosterTemplateCode may already have added Code + index.
            migrationBuilder.Sql(
                """
                ALTER TABLE "RosterTemplates" ADD COLUMN IF NOT EXISTS "Code" character varying(50) NULL;
                UPDATE "RosterTemplates"
                SET "Code" = LEFT(REGEXP_REPLACE(COALESCE(NULLIF(TRIM("Name"), ''), 'ROSTER'), '[^A-Za-z0-9]+', '-', 'g'), 40)
                    || '-' || SUBSTRING(REPLACE("Id"::text, '-', ''), 1, 6)
                WHERE "Code" IS NULL OR TRIM("Code") = '';
                ALTER TABLE "RosterTemplates" ALTER COLUMN "Code" SET NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_RosterTemplates_Code" ON "RosterTemplates" ("Code");
                """);

            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "EmployeeEvaluations" (
                    "Id" uuid NOT NULL,
                    "EmployeeId" uuid NOT NULL,
                    "Rating" integer NOT NULL,
                    "Comment" character varying(2000),
                    "EvaluatorEmployeeId" uuid,
                    "EvaluatorName" character varying(200),
                    "CreatedAt" timestamp without time zone NOT NULL,
                    "UpdatedAt" timestamp without time zone,
                    "IsDeleted" boolean NOT NULL,
                    "CreatedBy" text,
                    "UpdatedBy" text,
                    CONSTRAINT "PK_EmployeeEvaluations" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_EmployeeEvaluations_Employees_EmployeeId"
                        FOREIGN KEY ("EmployeeId") REFERENCES "Employees" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_EmployeeEvaluations_Employees_EvaluatorEmployeeId"
                        FOREIGN KEY ("EvaluatorEmployeeId") REFERENCES "Employees" ("Id") ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS "IX_EmployeeEvaluations_CreatedAt" ON "EmployeeEvaluations" ("CreatedAt");
                CREATE INDEX IF NOT EXISTS "IX_EmployeeEvaluations_EmployeeId" ON "EmployeeEvaluations" ("EmployeeId");
                CREATE INDEX IF NOT EXISTS "IX_EmployeeEvaluations_EvaluatorEmployeeId" ON "EmployeeEvaluations" ("EvaluatorEmployeeId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TABLE IF EXISTS "EmployeeEvaluations";
                """);

            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS "IX_RosterTemplates_Code";
                ALTER TABLE "RosterTemplates" DROP COLUMN IF EXISTS "Code";
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "RosterTemplates",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);
        }
    }
}
