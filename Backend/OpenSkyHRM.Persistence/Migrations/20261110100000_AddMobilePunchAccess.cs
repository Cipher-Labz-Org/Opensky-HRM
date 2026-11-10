using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261110100000_AddMobilePunchAccess")]
public partial class AddMobilePunchAccess : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "BusinessUnits" ADD COLUMN IF NOT EXISTS "AllowMobilePunch" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "Locations" ADD COLUMN IF NOT EXISTS "AllowMobilePunch" boolean NOT NULL DEFAULT FALSE;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "BusinessUnits" DROP COLUMN IF EXISTS "AllowMobilePunch";
            ALTER TABLE "Locations" DROP COLUMN IF EXISTS "AllowMobilePunch";
            """);
    }
}
