using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260825143000_SetShortLeaveToThreeHours")]
public partial class SetShortLeaveToThreeHours : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "LeaveTypes"
            SET "ShortLeaveHours" = 3,
                "AllowShortLeave" = TRUE,
                "AllowHalfDay" = FALSE,
                "MinDays" = NULL,
                "MaxDays" = 0.375,
                "DefaultDaysPerYear" = 0,
                "Description" = 'Short leave of 3 hours on a single day'
            WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "LeaveTypes"
            SET "ShortLeaveHours" = 2,
                "MaxDays" = 0.25,
                "DefaultDaysPerYear" = 2,
                "Description" = 'Short leave of 2 hours on a single day'
            WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted";
            """);
    }
}
