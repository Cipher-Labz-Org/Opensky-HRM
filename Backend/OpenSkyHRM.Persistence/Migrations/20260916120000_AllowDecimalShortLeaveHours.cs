using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260916120000_AllowDecimalShortLeaveHours")]
public partial class AllowDecimalShortLeaveHours : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" TYPE numeric;
            ALTER TABLE "LeaveTypes" ALTER COLUMN "MinHours" TYPE numeric;
            ALTER TABLE "LeaveTypes" ALTER COLUMN "MaxHours" TYPE numeric;
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" SET DEFAULT 3;

            ALTER TABLE "LeaveRequests" ALTER COLUMN "ShortLeaveHours" TYPE numeric;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" TYPE integer USING ROUND("ShortLeaveHours");
            ALTER TABLE "LeaveTypes" ALTER COLUMN "MinHours" TYPE integer USING ROUND("MinHours");
            ALTER TABLE "LeaveTypes" ALTER COLUMN "MaxHours" TYPE integer USING ROUND("MaxHours");
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" SET DEFAULT 3;

            ALTER TABLE "LeaveRequests" ALTER COLUMN "ShortLeaveHours" TYPE integer USING ROUND("ShortLeaveHours");
            """);
    }
}
