using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260422120000_AddLeaveRequestMedicalCertificateUrl")]
public partial class AddLeaveRequestMedicalCertificateUrl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveRequests" ADD COLUMN IF NOT EXISTS "MedicalCertificateUrl" text NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "LeaveRequests" DROP COLUMN IF EXISTS "MedicalCertificateUrl";
            """);
    }
}
