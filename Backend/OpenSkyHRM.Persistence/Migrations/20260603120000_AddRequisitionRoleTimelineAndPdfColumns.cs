using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260603120000_AddRequisitionRoleTimelineAndPdfColumns")]
public partial class AddRequisitionRoleTimelineAndPdfColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // These properties exist on the Requisition entity and in the model snapshot,
        // but no migration ever created the columns, so every database was missing them
        // (PostgreSQL error 42703: column "RoleTimelineJson" does not exist).
        // IF NOT EXISTS keeps this safe to run against databases that already have them.
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "RoleTimelineJson" text NULL;
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SupportingPdfStoredFileName" text NULL;
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SupportingPdfOriginalFileName" text NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" DROP COLUMN IF EXISTS "RoleTimelineJson";
            ALTER TABLE "Requisitions" DROP COLUMN IF EXISTS "SupportingPdfStoredFileName";
            ALTER TABLE "Requisitions" DROP COLUMN IF EXISTS "SupportingPdfOriginalFileName";
            """);
    }
}
