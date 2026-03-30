using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

/// <summary>
/// The entity was present in the model snapshot but no prior migration created this table.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260327100000_CreateEmploymentStatusTypes")]
public partial class CreateEmploymentStatusTypes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""EmploymentStatusTypes"" (
    ""Id"" uuid NOT NULL,
    ""Name"" text NOT NULL,
    ""Code"" text NOT NULL,
    ""Description"" text NULL,
    ""IsActive"" boolean NOT NULL,
    ""IsSystem"" boolean NOT NULL,
    ""SortOrder"" integer NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_EmploymentStatusTypes"" PRIMARY KEY (""Id"")
);
");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""EmploymentStatusTypes"";");
    }
}
