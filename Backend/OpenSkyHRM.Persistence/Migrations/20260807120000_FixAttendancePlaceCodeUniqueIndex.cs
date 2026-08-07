using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260807120000_FixAttendancePlaceCodeUniqueIndex")]
public partial class FixAttendancePlaceCodeUniqueIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_AttendancePlaces_Code",
            table: "AttendancePlaces");

        migrationBuilder.CreateIndex(
            name: "IX_AttendancePlaces_Code",
            table: "AttendancePlaces",
            column: "Code",
            unique: true,
            filter: "NOT \"IsDeleted\"");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_AttendancePlaces_Code",
            table: "AttendancePlaces");

        migrationBuilder.CreateIndex(
            name: "IX_AttendancePlaces_Code",
            table: "AttendancePlaces",
            column: "Code",
            unique: true);
    }
}
