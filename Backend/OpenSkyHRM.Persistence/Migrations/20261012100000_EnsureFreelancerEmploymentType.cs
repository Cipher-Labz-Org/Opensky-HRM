using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261012100000_EnsureFreelancerEmploymentType")]
public partial class EnsureFreelancerEmploymentType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO "EmploymentStatusTypes" ("Id","Name","Code","IsActive","IsSystem","SortOrder","CreatedAt","IsDeleted")
            SELECT gen_random_uuid(), 'Freelancer', 'Freelance', true, true, 8, now(), false
            WHERE NOT EXISTS (
                SELECT 1 FROM "EmploymentStatusTypes"
                WHERE "IsDeleted" = false
                  AND ("Code" ILIKE 'Freelance' OR "Code" ILIKE 'Freelancer')
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
