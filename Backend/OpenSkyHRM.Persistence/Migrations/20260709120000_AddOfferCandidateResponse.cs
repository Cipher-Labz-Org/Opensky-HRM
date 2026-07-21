using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using OpenSkyHRM.Persistence;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260709120000_AddOfferCandidateResponse")]
public partial class AddOfferCandidateResponse : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "NegotiationMessage",
            table: "Offers",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "NegotiationRequestedAt",
            table: "Offers",
            type: "timestamp without time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "ResponseToken",
            table: "Offers",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "SentAt",
            table: "Offers",
            type: "timestamp without time zone",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Offers_ResponseToken",
            table: "Offers",
            column: "ResponseToken",
            unique: true,
            filter: "\"ResponseToken\" IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Offers_ResponseToken",
            table: "Offers");

        migrationBuilder.DropColumn(
            name: "NegotiationMessage",
            table: "Offers");

        migrationBuilder.DropColumn(
            name: "NegotiationRequestedAt",
            table: "Offers");

        migrationBuilder.DropColumn(
            name: "ResponseToken",
            table: "Offers");

        migrationBuilder.DropColumn(
            name: "SentAt",
            table: "Offers");
    }
}
