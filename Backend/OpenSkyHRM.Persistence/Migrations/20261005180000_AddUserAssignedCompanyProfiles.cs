using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261005180000_AddUserAssignedCompanyProfiles")]
public partial class AddUserAssignedCompanyProfiles : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS "UserAssignedCompanyProfiles" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "CompanyProfileKey" character varying(64) NOT NULL,
                "CreatedAt" timestamp without time zone NOT NULL,
                "UpdatedAt" timestamp without time zone NULL,
                "IsDeleted" boolean NOT NULL DEFAULT false,
                "CreatedBy" text NULL,
                "UpdatedBy" text NULL,
                CONSTRAINT "PK_UserAssignedCompanyProfiles" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_UserAssignedCompanyProfiles_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserAssignedCompanyProfiles_UserId_CompanyProfileKey"
                ON "UserAssignedCompanyProfiles" ("UserId", "CompanyProfileKey");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP TABLE IF EXISTS "UserAssignedCompanyProfiles";""");
    }
}
