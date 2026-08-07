using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260807103000_AddAttendancePlaces")]
public partial class AddAttendancePlaces : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Locations" DROP COLUMN IF EXISTS "GeofenceEnabled";
            ALTER TABLE "Locations" DROP COLUMN IF EXISTS "GeofenceRadiusMeters";
            ALTER TABLE "Locations" DROP COLUMN IF EXISTS "Latitude";
            ALTER TABLE "Locations" DROP COLUMN IF EXISTS "Longitude";
            """);

        migrationBuilder.CreateTable(
            name: "AttendancePlaces",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                IsActive = table.Column<bool>(type: "boolean", nullable: false),
                GeofenceEnabled = table.Column<bool>(type: "boolean", nullable: false),
                GeofenceRadiusMeters = table.Column<int>(type: "integer", nullable: false, defaultValue: 20),
                Latitude = table.Column<decimal>(type: "numeric", nullable: true),
                Longitude = table.Column<decimal>(type: "numeric", nullable: true),
                LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                BusinessUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AttendancePlaces", x => x.Id);
                table.ForeignKey(
                    name: "FK_AttendancePlaces_BusinessUnits_BusinessUnitId",
                    column: x => x.BusinessUnitId,
                    principalTable: "BusinessUnits",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_AttendancePlaces_Locations_LocationId",
                    column: x => x.LocationId,
                    principalTable: "Locations",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_AttendancePlaces_BusinessUnitId",
            table: "AttendancePlaces",
            column: "BusinessUnitId",
            unique: true,
            filter: "\"BusinessUnitId\" IS NOT NULL AND NOT \"IsDeleted\"");

        migrationBuilder.CreateIndex(
            name: "IX_AttendancePlaces_Code",
            table: "AttendancePlaces",
            column: "Code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_AttendancePlaces_LocationId",
            table: "AttendancePlaces",
            column: "LocationId",
            unique: true,
            filter: "\"LocationId\" IS NOT NULL AND NOT \"IsDeleted\"");

        migrationBuilder.AddColumn<Guid>(
            name: "AttendancePlaceId",
            table: "AttendanceRecords",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_AttendanceRecords_AttendancePlaceId",
            table: "AttendanceRecords",
            column: "AttendancePlaceId");

        migrationBuilder.AddForeignKey(
            name: "FK_AttendanceRecords_AttendancePlaces_AttendancePlaceId",
            table: "AttendanceRecords",
            column: "AttendancePlaceId",
            principalTable: "AttendancePlaces",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.Sql("""
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'AttendanceCheckInMode', 'BusinessUnitQr', 'Attendance check-in policy: Open, LocationGeofence, BusinessUnitQr, BusinessUnitGeofence, Hybrid'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "Key" = 'AttendanceCheckInMode');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE FROM "SystemSettings" WHERE "Key" = 'AttendanceCheckInMode';
            """);

        migrationBuilder.DropForeignKey(
            name: "FK_AttendanceRecords_AttendancePlaces_AttendancePlaceId",
            table: "AttendanceRecords");

        migrationBuilder.DropIndex(
            name: "IX_AttendanceRecords_AttendancePlaceId",
            table: "AttendanceRecords");

        migrationBuilder.DropColumn(
            name: "AttendancePlaceId",
            table: "AttendanceRecords");

        migrationBuilder.DropTable(
            name: "AttendancePlaces");
    }
}
