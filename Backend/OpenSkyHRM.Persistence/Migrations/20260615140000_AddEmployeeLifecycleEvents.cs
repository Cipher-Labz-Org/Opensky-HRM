using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260615140000_AddEmployeeLifecycleEvents")]
public partial class AddEmployeeLifecycleEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "EmployeeLifecycleEvents",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                EventType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                EventDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                Summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                DetailsJson = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                Source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                ExternalKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_EmployeeLifecycleEvents", x => x.Id);
                table.ForeignKey(
                    name: "FK_EmployeeLifecycleEvents_Employees_EmployeeId",
                    column: x => x.EmployeeId,
                    principalTable: "Employees",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeLifecycleEvents_EmployeeId",
            table: "EmployeeLifecycleEvents",
            column: "EmployeeId");

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeLifecycleEvents_EmployeeId_EventDate",
            table: "EmployeeLifecycleEvents",
            columns: new[] { "EmployeeId", "EventDate" });

        migrationBuilder.CreateIndex(
            name: "IX_EmployeeLifecycleEvents_ExternalKey",
            table: "EmployeeLifecycleEvents",
            column: "ExternalKey",
            unique: true,
            filter: "\"ExternalKey\" IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "EmployeeLifecycleEvents");
    }
}
