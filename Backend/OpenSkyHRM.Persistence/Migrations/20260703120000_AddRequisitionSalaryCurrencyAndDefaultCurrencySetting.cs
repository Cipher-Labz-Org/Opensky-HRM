using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260703120000_AddRequisitionSalaryCurrencyAndDefaultCurrencySetting")]
public partial class AddRequisitionSalaryCurrencyAndDefaultCurrencySetting : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SalaryCurrency" character varying(10) NULL;
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'DefaultCurrency', 'LKR', 'Default ISO 4217 currency for salary ranges and recruitment offers'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "Key" = 'DefaultCurrency');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Requisitions" DROP COLUMN IF EXISTS "SalaryCurrency";
            DELETE FROM "SystemSettings" WHERE "Key" = 'DefaultCurrency';
            """);
    }
}
