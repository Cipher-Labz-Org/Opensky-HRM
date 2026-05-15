using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

public partial class AddUserNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            CREATE TABLE IF NOT EXISTS ""UserNotifications"" (
                ""Id"" uuid NOT NULL,
                ""UserId"" uuid NOT NULL,
                ""Title"" character varying(200) NOT NULL,
                ""Body"" character varying(2000) NOT NULL,
                ""Category"" character varying(80) NOT NULL,
                ""DedupeKey"" character varying(256) NOT NULL,
                ""RelatedEmployeeAttachmentId"" uuid,
                ""ReadAt"" timestamp without time zone,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone,
                ""IsDeleted"" boolean NOT NULL DEFAULT FALSE,
                CONSTRAINT ""PK_UserNotifications"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_UserNotifications_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
                CONSTRAINT ""FK_UserNotifications_EmployeeAttachments_RelatedEmployeeAttachmentId"" FOREIGN KEY (""RelatedEmployeeAttachmentId"") REFERENCES ""EmployeeAttachments"" (""Id"") ON DELETE SET NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserNotifications_DedupeKey""
                ON ""UserNotifications"" (""DedupeKey"");

            CREATE INDEX IF NOT EXISTS ""IX_UserNotifications_RelatedEmployeeAttachmentId""
                ON ""UserNotifications"" (""RelatedEmployeeAttachmentId"");

            CREATE INDEX IF NOT EXISTS ""IX_UserNotifications_UserId_CreatedAt""
                ON ""UserNotifications"" (""UserId"", ""CreatedAt"");
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DROP TABLE IF EXISTS ""UserNotifications"";
        ");
    }
}
