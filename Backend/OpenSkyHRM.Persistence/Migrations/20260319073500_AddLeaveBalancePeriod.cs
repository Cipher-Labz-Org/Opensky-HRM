using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260319073500_AddLeaveBalancePeriod")]
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
