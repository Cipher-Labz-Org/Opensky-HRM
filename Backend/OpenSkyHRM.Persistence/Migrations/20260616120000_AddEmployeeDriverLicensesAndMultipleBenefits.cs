using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260616120000_AddEmployeeDriverLicensesAndMultipleBenefits")]
public partial class AddEmployeeDriverLicensesAndMultipleBenefits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "EmployeeDriverLicenses",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                Number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                LicenseType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                IssueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                ExpiryDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IssuingCountry = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EmployeeDriverLicenses", x => x.Id);
                table.ForeignKey(
                    name: "FK_EmployeeDriverLicenses_Employees_EmployeeId",
                    column: x => x.EmployeeId,
                    principalTable: "Employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeDriverLicenses_EmployeeId",
            table: "EmployeeDriverLicenses",
            column: "EmployeeId");

        migrationBuilder.DropIndex(
            name: "IX_EmployeeBenefits_EmployeeId",
            table: "EmployeeBenefits");

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeBenefits_EmployeeId",
            table: "EmployeeBenefits",
            column: "EmployeeId");

        migrationBuilder.Sql("""
            INSERT INTO "EmployeeDriverLicenses" (
                "Id", "EmployeeId", "Number", "LicenseType", "IssueDate", "ExpiryDate", "IssuingCountry", "CreatedAt", "IsDeleted"
            )
            SELECT
                gen_random_uuid(),
                "Id",
                "DriversLicenseNumber",
                "DriversLicenseType",
                "LicenseIssueDate",
                "LicenseExpiryDate",
                "DriversLicenseIssuingCountry",
                NOW() AT TIME ZONE 'UTC',
                false
            FROM "Employees"
            WHERE "IsDeleted" = false
              AND (
                "DriversLicenseNumber" IS NOT NULL
                OR "DriversLicenseType" IS NOT NULL
                OR "LicenseIssueDate" IS NOT NULL
                OR "LicenseExpiryDate" IS NOT NULL
                OR "DriversLicenseIssuingCountry" IS NOT NULL
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "EmployeeDriverLicenses" dl
                WHERE dl."EmployeeId" = "Employees"."Id"
                  AND dl."IsDeleted" = false
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "EmployeeDriverLicenses");

        migrationBuilder.DropIndex(
            name: "IX_EmployeeBenefits_EmployeeId",
            table: "EmployeeBenefits");

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeBenefits_EmployeeId",
            table: "EmployeeBenefits",
            column: "EmployeeId",
            unique: true);
    }
}
