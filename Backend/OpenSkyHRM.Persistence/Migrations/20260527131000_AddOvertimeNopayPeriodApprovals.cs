using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOvertimeNopayPeriodApprovals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OvertimeNopayPeriodApprovals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PeriodTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OvertimeHoursSnapshot = table.Column<decimal>(type: "numeric", nullable: false),
                    ApproverId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActionAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Remarks = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OvertimeNopayPeriodApprovals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OvertimeNopayPeriodApprovals_Employees_ApproverId",
                        column: x => x.ApproverId,
                        principalTable: "Employees",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OvertimeNopayPeriodApprovals_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OvertimeNopayPeriodApprovals_ApproverId",
                table: "OvertimeNopayPeriodApprovals",
                column: "ApproverId");

            migrationBuilder.CreateIndex(
                name: "IX_OvertimeNopayPeriodApprovals_EmployeeId",
                table: "OvertimeNopayPeriodApprovals",
                column: "EmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OvertimeNopayPeriodApprovals");
        }
    }
}
