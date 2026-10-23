using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260326170000_AddEmployeeAttachmentTypes")]
public partial class AddEmployeeAttachmentTypes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            CREATE TABLE IF NOT EXISTS ""EmployeeAttachmentTypes"" (
                ""Id"" uuid NOT NULL,
                ""Name"" character varying(150) NOT NULL,
                ""Code"" character varying(50) NOT NULL,
                ""Description"" character varying(500),
                ""IsActive"" boolean NOT NULL DEFAULT TRUE,
                ""SortOrder"" integer NOT NULL DEFAULT 0,
                ""CreatedAt"" timestamp without time zone NOT NULL,
                ""UpdatedAt"" timestamp without time zone,
                ""IsDeleted"" boolean NOT NULL DEFAULT FALSE,
                ""CreatedBy"" text,
                ""UpdatedBy"" text,
                CONSTRAINT ""PK_EmployeeAttachmentTypes"" PRIMARY KEY (""Id"")
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_EmployeeAttachmentTypes_Code""
                ON ""EmployeeAttachmentTypes"" (""Code"");

            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'EmployeeAttachments' AND column_name = 'AttachmentTypeId'
                ) THEN
                    ALTER TABLE ""EmployeeAttachments"" ADD COLUMN ""AttachmentTypeId"" uuid;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = current_schema() AND table_name = 'EmployeeAttachments' AND column_name = 'ExpiryDate'
                ) THEN
                    ALTER TABLE ""EmployeeAttachments"" ADD COLUMN ""ExpiryDate"" timestamp without time zone;
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS ""IX_EmployeeAttachments_AttachmentTypeId""
                ON ""EmployeeAttachments"" (""AttachmentTypeId"");

            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_EmployeeAttachments_EmployeeAttachmentTypes_AttachmentTypeId'
                ) THEN
                    ALTER TABLE ""EmployeeAttachments""
                    ADD CONSTRAINT ""FK_EmployeeAttachments_EmployeeAttachmentTypes_AttachmentTypeId""
                    FOREIGN KEY (""AttachmentTypeId"") REFERENCES ""EmployeeAttachmentTypes"" (""Id"") ON DELETE RESTRICT;
                END IF;
            END $$;

            INSERT INTO ""EmployeeAttachmentTypes"" (""Id"", ""Name"", ""Code"", ""Description"", ""IsActive"", ""SortOrder"", ""CreatedAt"", ""IsDeleted"")
            SELECT gen_random_uuid(), v.name, v.code, NULL, TRUE, v.ord, (NOW() AT TIME ZONE 'utc'), FALSE
            FROM (VALUES
                (0, 'CV / Resume', 'ATT-CV'),
                (1, 'National ID', 'ATT-NIC'),
                (2, 'Passport', 'ATT-PASS'),
                (3, 'Educational certificate', 'ATT-EDU'),
                (4, 'Employment contract', 'ATT-CONT')
            ) AS v(ord, name, code)
            WHERE NOT EXISTS (SELECT 1 FROM ""EmployeeAttachmentTypes"" t WHERE t.""Code"" = v.code);
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            ALTER TABLE ""EmployeeAttachments"" DROP CONSTRAINT IF EXISTS ""FK_EmployeeAttachments_EmployeeAttachmentTypes_AttachmentTypeId"";
            DROP INDEX IF EXISTS ""IX_EmployeeAttachments_AttachmentTypeId"";
            ALTER TABLE ""EmployeeAttachments"" DROP COLUMN IF EXISTS ""ExpiryDate"";
            ALTER TABLE ""EmployeeAttachments"" DROP COLUMN IF EXISTS ""AttachmentTypeId"";
            DROP TABLE IF EXISTS ""EmployeeAttachmentTypes"";
        ");
    }
}
