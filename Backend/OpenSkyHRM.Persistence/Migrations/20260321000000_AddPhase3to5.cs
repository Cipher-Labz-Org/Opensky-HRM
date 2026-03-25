using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260321000000_AddPhase3to5")]
    public partial class AddPhase3to5 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "AttendanceRecords",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "AttendanceRecords",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BiometricDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DeviceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BiometricDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PunchImportBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TotalRecords = table.Column<int>(type: "integer", nullable: false),
                    SuccessCount = table.Column<int>(type: "integer", nullable: false),
                    FailCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ErrorDetails = table.Column<string>(type: "text", nullable: true),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PunchImportBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PunchImportBatches_BiometricDevices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "BiometricDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BiometricDevices_SerialNumber",
                table: "BiometricDevices",
                column: "SerialNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PunchImportBatches_DeviceId",
                table: "PunchImportBatches",
                column: "DeviceId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "PunchImportBatches");
            migrationBuilder.DropTable(name: "BiometricDevices");
            migrationBuilder.DropColumn(name: "Latitude", table: "AttendanceRecords");
            migrationBuilder.DropColumn(name: "Longitude", table: "AttendanceRecords");
        }
    }
}
