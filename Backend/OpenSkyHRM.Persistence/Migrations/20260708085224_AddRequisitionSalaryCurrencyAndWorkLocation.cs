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
            migrationBuilder.AddColumn<string>(
                name: "SalaryCurrency",
                table: "Requisitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkLocation",
                table: "Requisitions",
                type: "text",
                nullable: true);

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
