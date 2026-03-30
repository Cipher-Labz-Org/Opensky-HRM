using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260322150000_AddMissingEntities")]
    public partial class AddMissingEntities : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""OnboardingTasks""
                    ADD COLUMN IF NOT EXISTS ""AssignmentType"" character varying(20) NOT NULL DEFAULT 'User',
                    ADD COLUMN IF NOT EXISTS ""AssignedToUserId"" uuid NULL;

                ALTER TABLE ""OffboardingTasks""
                    ADD COLUMN IF NOT EXISTS ""AssignmentType"" character varying(20) NOT NULL DEFAULT 'User',
                    ADD COLUMN IF NOT EXISTS ""AssignedToUserId"" uuid NULL;

                CREATE TABLE IF NOT EXISTS ""OffboardingTaskTemplates"" (
                    ""Id"" uuid NOT NULL,
                    ""Title"" character varying(200) NOT NULL,
                    ""Description"" text NULL,
                    ""Category"" character varying(100) NOT NULL,
                    ""SortOrder"" integer NOT NULL DEFAULT 0,
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""AssignmentType"" character varying(20) NOT NULL DEFAULT 'User',
                    ""AssignedToUserId"" uuid NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL DEFAULT now(),
                    ""CreatedBy"" text NULL,
                    ""UpdatedAt"" timestamp without time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    CONSTRAINT ""PK_OffboardingTaskTemplates"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS ""EmployeeTaskTemplates"" (
                    ""Id"" uuid NOT NULL,
                    ""Name"" character varying(200) NOT NULL,
                    ""Description"" text NULL,
                    ""Type"" character varying(20) NOT NULL DEFAULT 'Offboarding',
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedAt"" timestamp without time zone NOT NULL DEFAULT now(),
                    ""CreatedBy"" text NULL,
                    ""UpdatedAt"" timestamp without time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    CONSTRAINT ""PK_EmployeeTaskTemplates"" PRIMARY KEY (""Id"")
                );

                CREATE TABLE IF NOT EXISTS ""EmployeeTaskTemplateItems"" (
                    ""Id"" uuid NOT NULL,
                    ""Title"" character varying(200) NOT NULL,
                    ""Description"" text NULL,
                    ""Category"" character varying(100) NOT NULL,
                    ""SortOrder"" integer NOT NULL DEFAULT 0,
                    ""AssignmentType"" character varying(20) NOT NULL DEFAULT 'User',
                    ""AssignedToUserId"" uuid NULL,
                    ""TemplateId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp without time zone NOT NULL DEFAULT now(),
                    ""CreatedBy"" text NULL,
                    ""UpdatedAt"" timestamp without time zone NULL,
                    ""UpdatedBy"" text NULL,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    CONSTRAINT ""PK_EmployeeTaskTemplateItems"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_EmployeeTaskTemplateItems_EmployeeTaskTemplates_TemplateId""
                        FOREIGN KEY (""TemplateId"") REFERENCES ""EmployeeTaskTemplates"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_EmployeeTaskTemplateItems_TemplateId""
                    ON ""EmployeeTaskTemplateItems"" (""TemplateId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS ""EmployeeTaskTemplateItems"";
                DROP TABLE IF EXISTS ""EmployeeTaskTemplates"";
                DROP TABLE IF EXISTS ""OffboardingTaskTemplates"";

                ALTER TABLE ""OnboardingTasks""
                    DROP COLUMN IF EXISTS ""AssignedToUserId"",
                    DROP COLUMN IF EXISTS ""AssignmentType"";

                ALTER TABLE ""OffboardingTasks""
                    DROP COLUMN IF EXISTS ""AssignedToUserId"",
                    DROP COLUMN IF EXISTS ""AssignmentType"";
            ");
        }
    }
}
