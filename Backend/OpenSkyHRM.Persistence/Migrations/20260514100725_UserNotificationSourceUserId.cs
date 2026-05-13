using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserNotificationSourceUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceUserId",
                table: "UserNotifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserNotifications_SourceUserId",
                table: "UserNotifications",
                column: "SourceUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserNotifications_Users_SourceUserId",
                table: "UserNotifications",
                column: "SourceUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserNotifications_Users_SourceUserId",
                table: "UserNotifications");

            migrationBuilder.DropIndex(
                name: "IX_UserNotifications_SourceUserId",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "SourceUserId",
                table: "UserNotifications");
        }
    }
}
