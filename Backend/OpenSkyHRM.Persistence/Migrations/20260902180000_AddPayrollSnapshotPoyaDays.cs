using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260902180000_AddPayrollSnapshotPoyaDays")]
    public partial class AddPayrollSnapshotPoyaDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatchAttendanceSnapshots"
                ADD COLUMN IF NOT EXISTS "PoyaDaysWorked" numeric(18,2) NOT NULL DEFAULT 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatchAttendanceSnapshots" DROP COLUMN IF EXISTS "PoyaDaysWorked";
                """);
        }
    }
}
