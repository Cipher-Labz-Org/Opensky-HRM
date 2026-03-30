using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260326150000_AddDriversLicenseTypeAndIssueDate")]
    public partial class AddDriversLicenseTypeAndIssueDate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'Employees' AND column_name = 'DriversLicenseType'
                    ) THEN
                        ALTER TABLE ""Employees"" ADD COLUMN ""DriversLicenseType"" character varying(80);
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'Employees' AND column_name = 'LicenseIssueDate'
                    ) THEN
                        ALTER TABLE ""Employees"" ADD COLUMN ""LicenseIssueDate"" timestamp without time zone;
                    END IF;
                END $$;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "LicenseIssueDate", table: "Employees");
            migrationBuilder.DropColumn(name: "DriversLicenseType", table: "Employees");
        }
    }
}
