using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20261022120000_AddPayrollSnapshotTotalWorkedHours")]
    public partial class AddPayrollSnapshotTotalWorkedHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatchAttendanceSnapshots"
                ADD COLUMN IF NOT EXISTS "TotalWorkedHours" numeric(18,2) NOT NULL DEFAULT 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatchAttendanceSnapshots" DROP COLUMN IF EXISTS "TotalWorkedHours";
                """);
        }
    }
}
