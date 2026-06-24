using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260612120000_AddHolidayKind")]
public partial class AddHolidayKind : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Kind",
            table: "Holidays",
            type: "text",
            nullable: false,
            defaultValue: "Public");

        migrationBuilder.Sql("""
            UPDATE "Holidays"
            SET "Kind" = 'Restricted'
            WHERE "IsRestricted" = true;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Kind",
            table: "Holidays");
    }
}
