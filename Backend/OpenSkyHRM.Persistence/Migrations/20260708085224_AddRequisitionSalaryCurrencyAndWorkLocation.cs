using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRequisitionSalaryCurrencyAndWorkLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SalaryCurrency may already exist from 20260703120000_AddRequisitionSalaryCurrencyAndDefaultCurrencySetting.
            migrationBuilder.Sql(
                """
                ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SalaryCurrency" text NULL;
                ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "WorkLocation" text NULL;
                """);

            migrationBuilder.Sql(
                """
                UPDATE "Requisitions"
                SET "SalaryCurrency" = 'LKR'
                WHERE "SalaryCurrency" IS NULL OR BTRIM("SalaryCurrency") = '';
                """);

            migrationBuilder.Sql(
                """
                UPDATE "Requisitions" r
                SET "WorkLocation" = l."Name"
                FROM "Locations" l
                WHERE r."LocationId" = l."Id"
                  AND (r."WorkLocation" IS NULL OR BTRIM(r."WorkLocation") = '');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkLocation",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "SalaryCurrency",
                table: "Requisitions");
        }
    }
}
