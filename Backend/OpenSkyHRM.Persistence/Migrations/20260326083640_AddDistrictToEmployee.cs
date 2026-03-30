using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDistrictToEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "Employees",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentDistrict",
                table: "Employees",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "District",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "PermanentDistrict",
                table: "Employees");
        }
    }
}
