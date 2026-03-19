using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    public partial class AddEmployeeShiftPatternId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShiftPatternId",
                table: "Employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_ShiftPatternId",
                table: "Employees",
                column: "ShiftPatternId");

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_ShiftPatterns_ShiftPatternId",
                table: "Employees",
                column: "ShiftPatternId",
                principalTable: "ShiftPatterns",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_ShiftPatterns_ShiftPatternId",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_ShiftPatternId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ShiftPatternId",
                table: "Employees");
        }
    }
}
