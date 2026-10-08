using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261007143000_AddShortLeaveRequestTimes")]
public partial class AddShortLeaveRequestTimes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "ShortLeaveStartTime" character varying(5) NULL;
            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "ShortLeaveEndTime" character varying(5) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "ShortLeaveEndTime";
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "ShortLeaveStartTime";
            """);
    }
}
