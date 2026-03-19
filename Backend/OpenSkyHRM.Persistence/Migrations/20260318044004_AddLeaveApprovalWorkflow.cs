using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CurrentApprovalLevel",
                table: "LeaveRequests",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "Level1ApprovedAt",
                table: "LeaveRequests",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Level1ApproverId",
                table: "LeaveRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Level1Remarks",
                table: "LeaveRequests",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Level2ApprovedAt",
                table: "LeaveRequests",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Level2ApproverId",
                table: "LeaveRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Level2Remarks",
                table: "LeaveRequests",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentApprovalLevel",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level1ApprovedAt",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level1ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level1Remarks",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level2ApprovedAt",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level2ApproverId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "Level2Remarks",
                table: "LeaveRequests");
        }
    }
}
