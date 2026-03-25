using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260324203000_AddAuditLogPeopleModuleColumns")]
public partial class AddAuditLogPeopleModuleColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Module",
            table: "AuditLogs",
            type: "character varying(64)",
            maxLength: 64,
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<Guid>(
            name: "SubjectEmployeeId",
            table: "AuditLogs",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_AuditLogs_Module_SubjectEmployeeId_Timestamp",
            table: "AuditLogs",
            columns: new[] { "Module", "SubjectEmployeeId", "Timestamp" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_AuditLogs_Module_SubjectEmployeeId_Timestamp",
            table: "AuditLogs");

        migrationBuilder.DropColumn(name: "SubjectEmployeeId", table: "AuditLogs");
        migrationBuilder.DropColumn(name: "Module", table: "AuditLogs");
    }
}
