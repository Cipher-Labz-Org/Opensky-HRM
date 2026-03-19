using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaveBalancePeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PeriodStart",
                table: "LeaveBalances",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PeriodEnd",
                table: "LeaveBalances",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PeriodStart", table: "LeaveBalances");
            migrationBuilder.DropColumn(name: "PeriodEnd", table: "LeaveBalances");
        }
    }
}
