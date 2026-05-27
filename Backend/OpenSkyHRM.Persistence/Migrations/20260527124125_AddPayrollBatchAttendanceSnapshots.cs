using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollBatchAttendanceSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PayrollBatchAttendanceSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApprovedOtHours = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    OtAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AttendanceNopayDays = table.Column<int>(type: "integer", nullable: false),
                    LeaveNopayDays = table.Column<int>(type: "integer", nullable: false),
                    TotalNopayDays = table.Column<int>(type: "integer", nullable: false),
                    OtApproved = table.Column<bool>(type: "boolean", nullable: false),
                    OtOutdated = table.Column<bool>(type: "boolean", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollBatchAttendanceSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollBatchAttendanceSnapshots_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollBatchAttendanceSnapshots_PayrollBatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "PayrollBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollBatchAttendanceSnapshots_BatchId_EmployeeId",
                table: "PayrollBatchAttendanceSnapshots",
                columns: new[] { "BatchId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollBatchAttendanceSnapshots_EmployeeId",
                table: "PayrollBatchAttendanceSnapshots",
                column: "EmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PayrollBatchAttendanceSnapshots");
        }
    }
}
