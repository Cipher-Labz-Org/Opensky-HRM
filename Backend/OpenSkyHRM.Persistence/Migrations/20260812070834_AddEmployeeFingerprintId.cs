using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeFingerprintId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FingerprintId",
                table: "Employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_FingerprintId",
                table: "Employees",
                column: "FingerprintId",
                unique: true,
                filter: "\"FingerprintId\" IS NOT NULL AND \"FingerprintId\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_FingerprintId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "FingerprintId",
                table: "Employees");
        }
    }
}
