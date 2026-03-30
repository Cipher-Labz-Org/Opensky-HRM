using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260324180000_AddOutboundEmailLogs")]
public partial class AddOutboundEmailLogs : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "OutboundEmailLogs",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                RecipientEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                RecipientName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                Subject = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                HttpStatusCode = table.Column<int>(type: "integer", nullable: true),
                FromEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                ErrorDetail = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_OutboundEmailLogs", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_OutboundEmailLogs_CreatedAt",
            table: "OutboundEmailLogs",
            column: "CreatedAt");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "OutboundEmailLogs");
    }
}
