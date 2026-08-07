using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

/// <summary>
/// Force company check-in policy to require business-unit or location QR for punch.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260807140000_RequireAttendanceQrCheckInMode")]
public partial class RequireAttendanceQrCheckInMode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "SystemSettings" ("Key", "Value", "Description")
            SELECT 'AttendanceCheckInMode', 'BusinessUnitQr',
                   'Attendance check-in policy: Open, LocationGeofence, BusinessUnitQr, BusinessUnitGeofence, Hybrid'
            WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "Key" = 'AttendanceCheckInMode');

            UPDATE "SystemSettings"
            SET "Value" = 'BusinessUnitQr'
            WHERE "Key" = 'AttendanceCheckInMode'
              AND ("Value" IS NULL OR TRIM("Value") = '' OR "Value" = 'Open');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Keep QR-required policy; do not restore Open.
    }
}
