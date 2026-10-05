using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261005120000_AddEmployeeCompanyProfileKey")]
public partial class AddEmployeeCompanyProfileKey : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "CompanyProfileKey" character varying(64) NOT NULL DEFAULT 'primary';
            UPDATE "Employees" SET "CompanyProfileKey" = 'primary' WHERE "CompanyProfileKey" IS NULL OR TRIM("CompanyProfileKey") = '';
            CREATE INDEX IF NOT EXISTS "IX_Employees_CompanyProfileKey" ON "Employees" ("CompanyProfileKey");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS "IX_Employees_CompanyProfileKey";
            ALTER TABLE "Employees" DROP COLUMN IF EXISTS "CompanyProfileKey";
            """);
    }
}
