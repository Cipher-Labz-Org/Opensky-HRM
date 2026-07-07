using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260703140000_AddRequisitionSkillTemplates")]
public partial class AddRequisitionSkillTemplates : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE TABLE IF NOT EXISTS "RequisitionSkillTemplates" (
                "Id" uuid NOT NULL,
                "Name" character varying(150) NOT NULL,
                "Keywords" character varying(500) NOT NULL,
                "Skills" character varying(2000) NOT NULL,
                "JobTitleId" uuid NULL,
                "SortOrder" integer NOT NULL DEFAULT 0,
                "IsActive" boolean NOT NULL DEFAULT TRUE,
                "IsDeleted" boolean NOT NULL DEFAULT FALSE,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NULL,
                "CreatedBy" text NULL,
                "UpdatedBy" text NULL,
                CONSTRAINT "PK_RequisitionSkillTemplates" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_RequisitionSkillTemplates_JobTitles_JobTitleId"
                    FOREIGN KEY ("JobTitleId") REFERENCES "JobTitles" ("Id") ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_RequisitionSkillTemplates_IsActive" ON "RequisitionSkillTemplates" ("IsActive");
            CREATE INDEX IF NOT EXISTS "IX_RequisitionSkillTemplates_SortOrder" ON "RequisitionSkillTemplates" ("SortOrder");
            CREATE INDEX IF NOT EXISTS "IX_RequisitionSkillTemplates_JobTitleId" ON "RequisitionSkillTemplates" ("JobTitleId");
            ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "RequisitionSkillTemplates" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP TABLE IF EXISTS "RequisitionSkillTemplates";""");
    }
}
