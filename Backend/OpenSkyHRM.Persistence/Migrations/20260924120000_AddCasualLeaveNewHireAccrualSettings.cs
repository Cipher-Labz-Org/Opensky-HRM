using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260924120000_AddCasualLeaveNewHireAccrualSettings")]
public partial class AddCasualLeaveNewHireAccrualSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'CasualLeaveNewHireHalfDayAccrualEnabled', 'false',
                   'When true, pre-permanency employees accrue 0.5 casual leave day per completed month from join until Date of Permanency (Shop & Office)'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "Key" = 'CasualLeaveNewHireHalfDayAccrualEnabled');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM "SystemSettings" WHERE "Key" = 'CasualLeaveNewHireHalfDayAccrualEnabled';
            """);
    }
}
