using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260813050000_AddRosterTemplateCode")]
public partial class AddRosterTemplateCode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
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
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS "IX_RosterTemplates_Code";
            ALTER TABLE "RosterTemplates" DROP COLUMN IF EXISTS "Code";
            """);
    }
}
