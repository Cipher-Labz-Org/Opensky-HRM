using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260609120000_MigratePhoneScreenStage")]
public partial class MigratePhoneScreenStage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "Candidates"
            SET "Stage" = 'Screening'
            WHERE "Stage" = 'Phone Screen';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
