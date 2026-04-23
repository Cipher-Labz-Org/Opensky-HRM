using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

/// <summary>
/// Carry-forward narrative JSON and other settings can exceed varchar(500).
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260423130000_ExtendSystemSettingValueMaxLength")]
public partial class ExtendSystemSettingValueMaxLength : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "Value",
            table: "SystemSettings",
            type: "character varying(20000)",
            maxLength: 20000,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(500)",
            oldMaxLength: 500);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "Value",
            table: "SystemSettings",
            type: "character varying(500)",
            maxLength: 500,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(20000)",
            oldMaxLength: 20000);
    }
}
