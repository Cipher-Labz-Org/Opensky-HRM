using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260326120000_AddEducationQualificationAndRemark")]
    public partial class AddEducationQualificationAndRemark : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Educations' AND column_name = 'QualificationName'
                    ) THEN
                        ALTER TABLE ""Educations"" ADD COLUMN ""QualificationName"" text;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Educations' AND column_name = 'Remark'
                    ) THEN
                        ALTER TABLE ""Educations"" ADD COLUMN ""Remark"" text;
                    END IF;
                END $$;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "QualificationName", table: "Educations");
            migrationBuilder.DropColumn(name: "Remark", table: "Educations");
        }
    }
}
