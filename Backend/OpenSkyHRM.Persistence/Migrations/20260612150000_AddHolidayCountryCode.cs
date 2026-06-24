using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260612150000_AddHolidayCountryCode")]
public partial class AddHolidayCountryCode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CountryCode",
            table: "Holidays",
            type: "text",
            nullable: false,
            defaultValue: "LK");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "CountryCode",
            table: "Holidays");
    }
}
