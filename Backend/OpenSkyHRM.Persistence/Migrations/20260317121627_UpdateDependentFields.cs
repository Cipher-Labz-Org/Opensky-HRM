using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDependentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Dependents",
                newName: "FirstName");

            migrationBuilder.AlterColumn<string>(
                name: "FirstName",
                table: "Dependents",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Dependents",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MaritalStatus",
                table: "Dependents",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                table: "Dependents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Organization",
                table: "Dependents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Dependents");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "Dependents");

            migrationBuilder.DropColumn(
                name: "MaritalStatus",
                table: "Dependents");

            migrationBuilder.DropColumn(
                name: "Occupation",
                table: "Dependents");

            migrationBuilder.DropColumn(
                name: "Organization",
                table: "Dependents");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Dependents",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }
    }
}
