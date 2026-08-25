using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260824120000_AddLeaveTypeHalfDayAndShortLeave")]
public partial class AddLeaveTypeHalfDayAndShortLeave : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "AllowHalfDay" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "AllowShortLeave" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "LeaveTypes" ADD COLUMN IF NOT EXISTS "ShortLeaveHours" integer NOT NULL DEFAULT 3;

            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "DurationKind" character varying(20) NOT NULL DEFAULT 'FullDay';
            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "HalfDayPeriod" character varying(20) NULL;
            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "ShortLeaveHours" integer NULL;

            UPDATE "LeaveTypes"
            SET "AllowHalfDay" = TRUE, "AllowShortLeave" = TRUE, "ShortLeaveHours" = 3
            WHERE "Code" = 'LT-CAS' AND NOT "IsDeleted";
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "DurationKind";
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "HalfDayPeriod";
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "ShortLeaveHours";

            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "AllowHalfDay";
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "AllowShortLeave";
            ALTER TABLE "LeaveTypes" DROP COLUMN IF EXISTS "ShortLeaveHours";
            """);
    }
}
