using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260902120000_AddPayrollBatchReviewAuditFields")]
    public partial class AddPayrollBatchReviewAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PayrollSchemaRepair runs before MigrateAsync, so these columns may already exist on
            // live tenants. Plain AddColumn throws 42701 and leaves the migration unrecorded.
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ReviewedBy" character varying(200);
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ReviewedAt" timestamp without time zone;
                ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp without time zone;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "PayrollBatches" DROP COLUMN IF EXISTS "ApprovedAt";
                ALTER TABLE "PayrollBatches" DROP COLUMN IF EXISTS "ReviewedAt";
                ALTER TABLE "PayrollBatches" DROP COLUMN IF EXISTS "ReviewedBy";
                """);
        }
    }
}
