using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPermanentAddressFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PermanentCity",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentCountry",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentStateProvince",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentStreet1",
                table: "Employees",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentStreet2",
                table: "Employees",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentZipPostalCode",
                table: "Employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PermanentCity",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentCountry",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentStateProvince",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentStreet1",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentStreet2",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentZipPostalCode",
                table: "Employees");
        }
    }
}
