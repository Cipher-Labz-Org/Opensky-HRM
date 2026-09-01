using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260824123000_SetCasualShortLeaveHoursTo3")]
public partial class SetCasualShortLeaveHoursTo3 : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" SET DEFAULT 3;
            UPDATE "LeaveTypes"
            SET "ShortLeaveHours" = 3
            WHERE "Code" = 'LT-CAS' AND NOT "IsDeleted";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ALTER COLUMN "ShortLeaveHours" SET DEFAULT 2;
            UPDATE "LeaveTypes"
            SET "ShortLeaveHours" = 2
            WHERE "Code" = 'LT-CAS' AND NOT "IsDeleted";
            """);
    }
}
