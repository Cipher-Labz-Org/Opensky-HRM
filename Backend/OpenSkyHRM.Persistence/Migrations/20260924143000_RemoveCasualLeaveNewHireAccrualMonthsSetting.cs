using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260924143000_RemoveCasualLeaveNewHireAccrualMonthsSetting")]
public partial class RemoveCasualLeaveNewHireAccrualMonthsSetting : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM "SystemSettings" WHERE "Key" = 'CasualLeaveNewHireHalfDayAccrualMonths';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'CasualLeaveNewHireHalfDayAccrualMonths', '12',
                   'Deprecated: accrual period is join date through Date of Permanency'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "Key" = 'CasualLeaveNewHireHalfDayAccrualMonths');
            """);
    }
}
