using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    public partial class AddTerminationReasonNote : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Employees"" ADD COLUMN IF NOT EXISTS ""TerminationReason"" character varying(100) NULL;
                ALTER TABLE ""Employees"" ADD COLUMN IF NOT EXISTS ""TerminationNote"" text NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Employees"" DROP COLUMN IF EXISTS ""TerminationReason"";
                ALTER TABLE ""Employees"" DROP COLUMN IF EXISTS ""TerminationNote"";
            ");
        }
    }
}
