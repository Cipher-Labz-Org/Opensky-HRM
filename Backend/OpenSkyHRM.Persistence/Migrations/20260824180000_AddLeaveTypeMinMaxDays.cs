using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260824180000_AddLeaveTypeMinMaxDays")]
public partial class AddLeaveTypeMinMaxDays : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MinDays" numeric NULL;
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "MaxDays" numeric NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "MinDays";
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "MaxDays";
            """);
    }
}
