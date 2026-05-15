using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260513130000_AddRequisitionRoleTimelineAndSupportingPdf")]
public partial class AddRequisitionRoleTimelineAndSupportingPdf : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions"
            ADD COLUMN IF NOT EXISTS "RoleTimelineJson" text NULL;
            ALTER TABLE "Requisitions"
            ADD COLUMN IF NOT EXISTS "SupportingPdfStoredFileName" text NULL;
            ALTER TABLE "Requisitions"
            ADD COLUMN IF NOT EXISTS "SupportingPdfOriginalFileName" text NULL;
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
