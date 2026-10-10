using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260921120000_MakeCandidateRequisitionOptional")]
public partial class MakeCandidateRequisitionOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // RecruitmentSchemaRepair may have already applied this on live tenants.
        migrationBuilder.Sql(
            """
            ALTER TABLE "Candidates" ALTER COLUMN "RequisitionId" DROP NOT NULL;

            ALTER TABLE "Candidates" DROP CONSTRAINT IF EXISTS "FK_Candidates_Requisitions_RequisitionId";

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'FK_Candidates_Requisitions_RequisitionId'
                ) THEN
                    ALTER TABLE "Candidates"
                        ADD CONSTRAINT "FK_Candidates_Requisitions_RequisitionId"
                        FOREIGN KEY ("RequisitionId") REFERENCES "Requisitions" ("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DELETE FROM "Candidates" WHERE "RequisitionId" IS NULL;

            ALTER TABLE "Candidates" DROP CONSTRAINT IF EXISTS "FK_Candidates_Requisitions_RequisitionId";

            ALTER TABLE "Candidates" ALTER COLUMN "RequisitionId" SET NOT NULL;

            ALTER TABLE "Candidates"
                ADD CONSTRAINT "FK_Candidates_Requisitions_RequisitionId"
                FOREIGN KEY ("RequisitionId") REFERENCES "Requisitions" ("Id") ON DELETE CASCADE;
            """);
    }
}
