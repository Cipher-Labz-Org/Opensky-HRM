using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBiometricAdmsIngestion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BiometricRawEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    EventType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Payload = table.Column<string>(type: "text", nullable: false),
                    SourceIp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ParseStatus = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    ParseError = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BiometricRawEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BiometricRawEvents_BiometricDevices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "BiometricDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BiometricPunchEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    RawEventId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeviceUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PunchAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PunchState = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    VerifyMode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ExternalLogId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DedupeHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ProcessedToAttendance = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BiometricPunchEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BiometricPunchEvents_BiometricDevices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "BiometricDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BiometricPunchEvents_BiometricRawEvents_RawEventId",
                        column: x => x.RawEventId,
                        principalTable: "BiometricRawEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BiometricPunchEvents_DedupeHash",
                table: "BiometricPunchEvents",
                column: "DedupeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BiometricPunchEvents_DeviceId_DeviceUserId_PunchAtUtc",
                table: "BiometricPunchEvents",
                columns: new[] { "DeviceId", "DeviceUserId", "PunchAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_BiometricPunchEvents_PunchAtUtc",
                table: "BiometricPunchEvents",
                column: "PunchAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_BiometricPunchEvents_RawEventId",
                table: "BiometricPunchEvents",
                column: "RawEventId");

            migrationBuilder.CreateIndex(
                name: "IX_BiometricRawEvents_DeviceId",
                table: "BiometricRawEvents",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_BiometricRawEvents_ReceivedAtUtc",
                table: "BiometricRawEvents",
                column: "ReceivedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BiometricPunchEvents");

            migrationBuilder.DropTable(
                name: "BiometricRawEvents");
        }
    }
}
