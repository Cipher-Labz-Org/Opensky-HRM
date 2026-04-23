using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260420120000_AddUserPeopleScopeAssignments")]
public partial class AddUserPeopleScopeAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""UserAssignedBusinessUnits"" (
    ""Id"" uuid NOT NULL,
    ""UserId"" uuid NOT NULL,
    ""BusinessUnitId"" uuid NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL DEFAULT false,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_UserAssignedBusinessUnits"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_UserAssignedBusinessUnits_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_UserAssignedBusinessUnits_BusinessUnits_BusinessUnitId"" FOREIGN KEY (""BusinessUnitId"") REFERENCES ""BusinessUnits"" (""Id"") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserAssignedBusinessUnits_UserId_BusinessUnitId"" ON ""UserAssignedBusinessUnits"" (""UserId"", ""BusinessUnitId"");

CREATE TABLE IF NOT EXISTS ""UserAssignedGrades"" (
    ""Id"" uuid NOT NULL,
    ""UserId"" uuid NOT NULL,
    ""GradeId"" uuid NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL DEFAULT false,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_UserAssignedGrades"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_UserAssignedGrades_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_UserAssignedGrades_Grades_GradeId"" FOREIGN KEY (""GradeId"") REFERENCES ""Grades"" (""Id"") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserAssignedGrades_UserId_GradeId"" ON ""UserAssignedGrades"" (""UserId"", ""GradeId"");

CREATE TABLE IF NOT EXISTS ""UserAssignedJobTitles"" (
    ""Id"" uuid NOT NULL,
    ""UserId"" uuid NOT NULL,
    ""JobTitleId"" uuid NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL DEFAULT false,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_UserAssignedJobTitles"" PRIMARY KEY (""Id""),
    CONSTRAINT ""FK_UserAssignedJobTitles_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_UserAssignedJobTitles_JobTitles_JobTitleId"" FOREIGN KEY (""JobTitleId"") REFERENCES ""JobTitles"" (""Id"") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserAssignedJobTitles_UserId_JobTitleId"" ON ""UserAssignedJobTitles"" (""UserId"", ""JobTitleId"");
");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ""UserAssignedJobTitles"";
DROP TABLE IF EXISTS ""UserAssignedGrades"";
DROP TABLE IF EXISTS ""UserAssignedBusinessUnits"";
");
    }
}
