using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260326140000_AddEmploymentTypeToWorkExperience")]
    public partial class AddEmploymentTypeToWorkExperience : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'WorkExperiences' AND column_name = 'EmploymentType'
                    ) THEN
                        ALTER TABLE ""WorkExperiences"" ADD COLUMN ""EmploymentType"" character varying(80);
                    END IF;
                END $$;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "EmploymentType", table: "WorkExperiences");
        }
    }
}
