using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollBatchEffectiveDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EffectiveFrom",
                table: "PayrollBatches",
                type: "timestamp without time zone",
                nullable: false,
                defaultValue: new DateTime(2000, 1, 1));

            migrationBuilder.AddColumn<DateTime>(
                name: "EffectiveTo",
                table: "PayrollBatches",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "PayrollBatches"
                SET "EffectiveFrom" = make_date("Year", "Month", 1),
                    "EffectiveTo" = (make_date("Year", "Month", 1) + interval '1 month' - interval '1 day')::timestamp
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "EffectiveFrom",
                table: "PayrollBatches",
                type: "timestamp without time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp without time zone",
                oldDefaultValue: new DateTime(2000, 1, 1));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EffectiveFrom",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "EffectiveTo",
                table: "PayrollBatches");
        }
    }
}
