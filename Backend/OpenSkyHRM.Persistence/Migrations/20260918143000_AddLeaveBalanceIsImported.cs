using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260918143000_AddLeaveBalanceIsImported")]
public partial class AddLeaveBalanceIsImported : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveBalances" ADD COLUMN IF NOT EXISTS "IsImported" boolean NOT NULL DEFAULT FALSE;

            UPDATE "LeaveBalances" AS lb
            SET "IsImported" = TRUE
            WHERE lb."IsImported" = FALSE
              AND (
                lb."Used" <> 0
                OR lb."CarriedForward" <> 0
                OR lb."BroughtForwardDays" <> 0
                OR EXISTS (
                    SELECT 1
                    FROM "LeaveTypes" lt
                    WHERE lt."Id" = lb."LeaveTypeId"
                      AND (
                        lt."Code" IN ('LT-COFF', 'LT-FSG')
                        OR lt."Name" ILIKE '%compensatory%'
                        OR lt."Name" ILIKE '%special grant%'
                        OR lt."Name" ILIKE '%freelancer%'
                      )
                )
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveBalances" DROP COLUMN IF EXISTS "IsImported";
            """);
    }
}
