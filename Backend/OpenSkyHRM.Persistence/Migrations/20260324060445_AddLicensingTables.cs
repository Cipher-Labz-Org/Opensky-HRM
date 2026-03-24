using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenSkyHRM.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLicensingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent for PostgreSQL: DBs that already have some columns (manual scripts) can still complete.
            migrationBuilder.Sql(@"
ALTER TABLE ""Departments"" DROP CONSTRAINT IF EXISTS ""FK_Departments_BusinessUnits_BusinessUnitId"";

ALTER TABLE ""PayrollBatches"" ADD COLUMN IF NOT EXISTS ""SelectedEmployeeIds"" text;

DO $empType$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Employees' AND column_name = 'EmploymentType'
  ) THEN
    ALTER TABLE ""Employees"" ADD COLUMN ""EmploymentType"" text NOT NULL DEFAULT '';
  END IF;
END $empType$;

ALTER TABLE ""EmployeeCompensations"" ADD COLUMN IF NOT EXISTS ""BatchId"" uuid;
");

            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""EmployeeStatusTypes"" (
    ""Id"" uuid NOT NULL,
    ""Name"" text NOT NULL,
    ""Code"" text NOT NULL,
    ""Description"" text NULL,
    ""IsActive"" boolean NOT NULL,
    ""IsSystem"" boolean NOT NULL,
    ""SortOrder"" integer NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_EmployeeStatusTypes"" PRIMARY KEY (""Id"")
);

CREATE TABLE IF NOT EXISTS ""InstanceSubscriptions"" (
    ""Id"" uuid NOT NULL,
    ""InstanceKey"" character varying(64) NOT NULL,
    ""Status"" integer NOT NULL,
    ""PlanName"" character varying(200) NOT NULL,
    ""ValidFrom"" timestamp without time zone NOT NULL,
    ""ValidUntil"" timestamp without time zone NULL,
    ""Notes"" character varying(2000) NULL,
    ""MaxEmployees"" integer NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_InstanceSubscriptions"" PRIMARY KEY (""Id"")
);

CREATE TABLE IF NOT EXISTS ""LicensedModules"" (
    ""Id"" uuid NOT NULL,
    ""Code"" character varying(80) NOT NULL,
    ""DisplayName"" character varying(200) NOT NULL,
    ""Category"" character varying(80) NOT NULL,
    ""SortOrder"" integer NOT NULL,
    ""IsRequired"" boolean NOT NULL,
    ""IsActive"" boolean NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_LicensedModules"" PRIMARY KEY (""Id"")
);

CREATE TABLE IF NOT EXISTS ""InstanceModuleEntitlements"" (
    ""Id"" uuid NOT NULL,
    ""InstanceSubscriptionId"" uuid NOT NULL,
    ""LicensedModuleId"" uuid NOT NULL,
    ""IsEnabled"" boolean NOT NULL,
    ""CreatedAt"" timestamp without time zone NOT NULL,
    ""UpdatedAt"" timestamp without time zone NULL,
    ""IsDeleted"" boolean NOT NULL,
    ""CreatedBy"" text NULL,
    ""UpdatedBy"" text NULL,
    CONSTRAINT ""PK_InstanceModuleEntitlements"" PRIMARY KEY (""Id"")
);
");

            migrationBuilder.Sql(@"
CREATE INDEX IF NOT EXISTS ""IX_EmployeeCompensations_BatchId"" ON ""EmployeeCompensations"" (""BatchId"");

CREATE INDEX IF NOT EXISTS ""IX_InstanceModuleEntitlements_LicensedModuleId""
  ON ""InstanceModuleEntitlements"" (""LicensedModuleId"");

CREATE UNIQUE INDEX IF NOT EXISTS ""IX_InstanceSubscriptions_InstanceKey"" ON ""InstanceSubscriptions"" (""InstanceKey"");

CREATE UNIQUE INDEX IF NOT EXISTS ""IX_LicensedModules_Code"" ON ""LicensedModules"" (""Code"");

DO $ime_unique$
BEGIN
  CREATE UNIQUE INDEX ""IX_InstanceModuleEntitlements_InstanceSubscriptionId_LicensedModuleId""
    ON ""InstanceModuleEntitlements"" (""InstanceSubscriptionId"", ""LicensedModuleId"");
EXCEPTION WHEN duplicate_object THEN NULL;
END $ime_unique$;

DO $fk_ime_sub$
BEGIN
  ALTER TABLE ""InstanceModuleEntitlements"" ADD CONSTRAINT ""FK_InstanceModuleEntitlements_InstanceSubscriptions_InstanceSubscr""
    FOREIGN KEY (""InstanceSubscriptionId"") REFERENCES ""InstanceSubscriptions"" (""Id"") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk_ime_sub$;

DO $fk_ime_lm$
BEGIN
  ALTER TABLE ""InstanceModuleEntitlements"" ADD CONSTRAINT ""FK_InstanceModuleEntitlements_LicensedModules_LicensedModuleId""
    FOREIGN KEY (""LicensedModuleId"") REFERENCES ""LicensedModules"" (""Id"") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk_ime_lm$;

DO $fk_dept_bu$
BEGIN
  ALTER TABLE ""Departments"" ADD CONSTRAINT ""FK_Departments_BusinessUnits_BusinessUnitId""
    FOREIGN KEY (""BusinessUnitId"") REFERENCES ""BusinessUnits"" (""Id"") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk_dept_bu$;

DO $fk_ec_batch$
BEGIN
  ALTER TABLE ""EmployeeCompensations"" ADD CONSTRAINT ""FK_EmployeeCompensations_PayrollBatches_BatchId""
    FOREIGN KEY (""BatchId"") REFERENCES ""PayrollBatches"" (""Id"");
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk_ec_batch$;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Departments_BusinessUnits_BusinessUnitId",
                table: "Departments");

            migrationBuilder.DropForeignKey(
                name: "FK_EmployeeCompensations_PayrollBatches_BatchId",
                table: "EmployeeCompensations");

            migrationBuilder.DropTable(
                name: "EmployeeStatusTypes");

            migrationBuilder.DropTable(
                name: "InstanceModuleEntitlements");

            migrationBuilder.DropTable(
                name: "InstanceSubscriptions");

            migrationBuilder.DropTable(
                name: "LicensedModules");

            migrationBuilder.DropIndex(
                name: "IX_EmployeeCompensations_BatchId",
                table: "EmployeeCompensations");

            migrationBuilder.DropColumn(
                name: "SelectedEmployeeIds",
                table: "PayrollBatches");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "BatchId",
                table: "EmployeeCompensations");

            migrationBuilder.AddForeignKey(
                name: "FK_Departments_BusinessUnits_BusinessUnitId",
                table: "Departments",
                column: "BusinessUnitId",
                principalTable: "BusinessUnits",
                principalColumn: "Id");
        }
    }
}
