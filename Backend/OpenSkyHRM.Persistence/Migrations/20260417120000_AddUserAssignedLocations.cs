using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260417120000_AddUserAssignedLocations")]
public partial class AddUserAssignedLocations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""UserAssignedLocations"" (
    ""Id"" uuid NOT NULL,
    ""UserId"" uuid NOT NULL,
    ""LocationId"" uuid NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL DEFAULT false,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_UserAssignedLocations"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_UserAssignedLocations_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_UserAssignedLocations_Locations_LocationId"" FOREIGN KEY (""LocationId"") REFERENCES ""Locations"" (""Id"") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserAssignedLocations_UserId_LocationId"" ON ""UserAssignedLocations"" (""UserId"", ""LocationId"");
");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""UserAssignedLocations"";");
    }
}
