using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260423103000_AddLeaveBalanceBroughtForwardDays")]
public partial class AddLeaveBalanceBroughtForwardDays : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveBalances" ADD COLUMN IF NOT EXISTS "BroughtForwardDays" numeric NOT NULL DEFAULT 0;
            UPDATE "LeaveBalances" SET "BroughtForwardDays" = "CarriedForward" WHERE "CarriedForward" > 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveBalances" DROP COLUMN IF EXISTS "BroughtForwardDays";
            """);
    }
}
