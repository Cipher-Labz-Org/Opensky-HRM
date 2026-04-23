using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260423120000_SeedCarryForwardAvailabilityMonthsDefault")]
public partial class SeedCarryForwardAvailabilityMonthsDefault : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'CarryForwardAvailabilityMonths', '3', 'Months from balance period start during which carry-forward may be used (1–12).'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" AS s WHERE s."Key" = 'CarryForwardAvailabilityMonths');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM "SystemSettings" WHERE "Key" = 'CarryForwardAvailabilityMonths' AND "Value" = '3';
            """);
    }
}
