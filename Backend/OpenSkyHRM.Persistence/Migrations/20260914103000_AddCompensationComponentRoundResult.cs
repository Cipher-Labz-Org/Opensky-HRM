using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260914103000_AddCompensationComponentRoundResult")]
    public partial class AddCompensationComponentRoundResult : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PayrollSchemaRepair runs before MigrateAsync, so this column already exists on
            // live tenants. A plain AddColumn would throw and leave the migration unrecorded.
            migrationBuilder.Sql(
                """
                ALTER TABLE "CompensationComponents"
                ADD COLUMN IF NOT EXISTS "RoundResult" boolean NOT NULL DEFAULT FALSE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "CompensationComponents" DROP COLUMN IF EXISTS "RoundResult";
                """);
        }
    }
}
