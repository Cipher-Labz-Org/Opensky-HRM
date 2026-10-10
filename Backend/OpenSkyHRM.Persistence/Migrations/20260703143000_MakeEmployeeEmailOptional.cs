using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations;

public partial class MakeEmployeeEmailOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            ALTER TABLE "Employees" ALTER COLUMN "Email" DROP NOT NULL;

            UPDATE "Employees"
            SET "Email" = NULL,
                "UpdatedAt" = NOW()
            WHERE "Email" ILIKE '%@employee.noemail.opensky.hrm'
               OR BTRIM("Email") = '';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE "Employees"
            SET "Email" = LOWER("EmployeeCode") || '@employee.noemail.opensky.hrm'
            WHERE "Email" IS NULL OR BTRIM("Email") = '';
            """);

        migrationBuilder.AlterColumn<string>(
            name: "Email",
            table: "Employees",
            type: "character varying(255)",
            maxLength: 255,
            nullable: false,
            defaultValue: "",
            oldClrType: typeof(string),
            oldType: "character varying(255)",
            oldMaxLength: 255,
            oldNullable: true);
    }
}
