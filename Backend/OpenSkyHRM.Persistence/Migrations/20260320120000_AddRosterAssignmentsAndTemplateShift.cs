using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260320120000_AddRosterAssignmentsAndTemplateShift")]
    public partial class AddRosterAssignmentsAndTemplateShift : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShiftPatternId",
                table: "RosterTemplates",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RosterTemplates_DefaultShiftPatternId",
                table: "RosterTemplates",
                column: "DefaultShiftPatternId");

            migrationBuilder.AddForeignKey(
                name: "FK_RosterTemplates_ShiftPatterns_DefaultShiftPatternId",
                table: "RosterTemplates",
                column: "DefaultShiftPatternId",
                principalTable: "ShiftPatterns",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.CreateTable(
                name: "RosterAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RosterTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RosterAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RosterAssignments_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RosterAssignments_RosterTemplates_RosterTemplateId",
                        column: x => x.RosterTemplateId,
                        principalTable: "RosterTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RosterAssignments_EmployeeId_EffectiveFrom",
                table: "RosterAssignments",
                columns: new[] { "EmployeeId", "EffectiveFrom" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RosterAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_RosterTemplates_ShiftPatterns_DefaultShiftPatternId",
                table: "RosterTemplates");

            migrationBuilder.DropIndex(
                name: "IX_RosterTemplates_DefaultShiftPatternId",
                table: "RosterTemplates");

            migrationBuilder.DropColumn(
                name: "DefaultShiftPatternId",
                table: "RosterTemplates");
        }
    }
}
