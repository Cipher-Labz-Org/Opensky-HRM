using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260421160000_AddRequisitionApplicationNotificationEmail")]
public partial class AddRequisitionApplicationNotificationEmail : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "ApplicationNotificationEmail" character varying(320) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" DROP COLUMN IF EXISTS "ApplicationNotificationEmail";
            """);
    }
}
