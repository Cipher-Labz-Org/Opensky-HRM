using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260825120000_AddShortLeaveCatalogType")]
public partial class AddShortLeaveCatalogType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "LeaveTypes" (
                "Id", "Name", "Code", "Description", "DefaultDaysPerYear", "IsPaid", "IsActive",
                "AllowHalfDay", "AllowShortLeave", "ShortLeaveHours", "MinDays", "MaxDays",
                "CreatedAt", "IsDeleted")
            SELECT
                gen_random_uuid(),
                'Short Leave',
                'LT-SHL',
                'Short leave of 2 hours on a single day',
                2,
                TRUE,
                TRUE,
                FALSE,
                TRUE,
                2,
                NULL,
                0.25,
                (CURRENT_TIMESTAMP AT TIME ZONE 'utc'),
                FALSE
            WHERE NOT EXISTS (
                SELECT 1 FROM "LeaveTypes" WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted"
            );

            UPDATE "LeaveTypes"
            SET "AllowShortLeave" = FALSE
            WHERE "Code" <> 'LT-SHL' AND NOT "IsDeleted";

            UPDATE "LeaveTypes"
            SET "AllowShortLeave" = TRUE,
                "AllowHalfDay" = FALSE,
                "ShortLeaveHours" = CASE WHEN "ShortLeaveHours" < 1 THEN 2 ELSE "ShortLeaveHours" END
            WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "LeaveTypes"
            SET "AllowHalfDay" = TRUE, "AllowShortLeave" = TRUE
            WHERE "Code" = 'LT-CAS' AND NOT "IsDeleted";

            UPDATE "LeaveTypes"
            SET "IsDeleted" = TRUE
            WHERE "Code" = 'LT-SHL' AND NOT "IsDeleted";
            """);
    }
}
