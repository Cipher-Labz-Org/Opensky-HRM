using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260902050000_AddCompensationComponentEpfEtfApplicable")]
    public partial class AddCompensationComponentEpfEtfApplicable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEpfApplicable",
                table: "CompensationComponents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsEtfApplicable",
                table: "CompensationComponents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                """
                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = "IsTaxable",
                    "IsEtfApplicable" = "IsTaxable"
                WHERE NOT "IsDeleted";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsEpfApplicable",
                table: "CompensationComponents");

            migrationBuilder.DropColumn(
                name: "IsEtfApplicable",
                table: "CompensationComponents");
        }
    }
}
