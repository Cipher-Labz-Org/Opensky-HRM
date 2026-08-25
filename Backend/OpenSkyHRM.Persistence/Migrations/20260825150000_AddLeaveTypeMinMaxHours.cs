using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260825150000_AddLeaveTypeMinMaxHours")]
public partial class AddLeaveTypeMinMaxHours : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MinHours" integer NULL;
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MaxHours" integer NULL;

            UPDATE "LeaveTypes"
            SET "MinDays" = NULL,
                "MaxDays" = NULL
            WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "MinHours";
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "MaxHours";
            """);
    }
}
