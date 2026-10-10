using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260902050000_AddCompensationComponentEpfEtfApplicable")]
    public partial class AddCompensationComponentEpfEtfApplicable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PayrollSchemaRepair runs before MigrateAsync, so these columns may already exist on
            // live tenants. Plain AddColumn throws 42701 and leaves the migration unrecorded.
            migrationBuilder.Sql(
                """
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEpfApplicable" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEtfApplicable" boolean NOT NULL DEFAULT FALSE;

                UPDATE "CompensationComponents"
                SET "IsEpfApplicable" = "IsTaxable",
                    "IsEtfApplicable" = "IsTaxable"
                WHERE NOT "IsDeleted"
                  AND "IsEpfApplicable" = FALSE
                  AND "IsEtfApplicable" = FALSE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "CompensationComponents" DROP COLUMN IF EXISTS "IsEpfApplicable";
                ALTER TABLE "CompensationComponents" DROP COLUMN IF EXISTS "IsEtfApplicable";
                """);
        }
    }
}
