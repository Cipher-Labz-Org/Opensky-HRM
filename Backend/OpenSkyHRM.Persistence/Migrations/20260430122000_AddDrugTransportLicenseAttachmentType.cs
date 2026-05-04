using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260430122000_AddDrugTransportLicenseAttachmentType")]
public partial class AddDrugTransportLicenseAttachmentType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            INSERT INTO ""EmployeeAttachmentTypes"" (""Id"", ""Name"", ""Code"", ""Description"", ""IsActive"", ""SortOrder"", ""CreatedAt"", ""IsDeleted"")
            SELECT gen_random_uuid(), 'Drug transport license', 'ATT-DRUG-TRANSPORT-LICENSE', NULL, TRUE, 5, (NOW() AT TIME ZONE 'utc'), FALSE
            WHERE NOT EXISTS (
                SELECT 1 FROM ""EmployeeAttachmentTypes"" t
                WHERE t.""Code"" = 'ATT-DRUG-TRANSPORT-LICENSE'
            );
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DELETE FROM ""EmployeeAttachmentTypes""
            WHERE ""Code"" = 'ATT-DRUG-TRANSPORT-LICENSE';
        ");
    }
}
