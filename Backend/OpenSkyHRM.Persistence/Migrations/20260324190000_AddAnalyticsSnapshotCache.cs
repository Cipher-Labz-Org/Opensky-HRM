using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260324190000_AddAnalyticsSnapshotCache")]
public partial class AddAnalyticsSnapshotCache : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AnalyticsSnapshotCaches",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                CacheKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                PayloadJson = table.Column<string>(type: "text", nullable: false),
                CapturedAtUtc = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AnalyticsSnapshotCaches", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_AnalyticsSnapshotCaches_CacheKey",
            table: "AnalyticsSnapshotCaches",
            column: "CacheKey",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "AnalyticsSnapshotCaches");
    }
}
