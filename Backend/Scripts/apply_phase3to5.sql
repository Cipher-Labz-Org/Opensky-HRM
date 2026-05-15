-- Phase 3b: Add geo columns to AttendanceRecords
ALTER TABLE "AttendanceRecords" ADD COLUMN IF NOT EXISTS "Latitude" numeric;
ALTER TABLE "AttendanceRecords" ADD COLUMN IF NOT EXISTS "Longitude" numeric;

-- Phase 4: BiometricDevices table
CREATE TABLE IF NOT EXISTS "BiometricDevices" (
    "Id" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "SerialNumber" character varying(100) NOT NULL,
    "Location" character varying(200),
    "DeviceType" character varying(50) NOT NULL,
    "IsActive" boolean NOT NULL DEFAULT true,
    "LastSyncAt" timestamp without time zone,
    "CreatedAt" timestamp without time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp without time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_BiometricDevices" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_BiometricDevices_SerialNumber" ON "BiometricDevices" ("SerialNumber");

-- Phase 4: PunchImportBatches table
CREATE TABLE IF NOT EXISTS "PunchImportBatches" (
    "Id" uuid NOT NULL,
    "FileName" character varying(500) NOT NULL,
    "ImportedAt" timestamp without time zone NOT NULL,
    "TotalRecords" integer NOT NULL DEFAULT 0,
    "SuccessCount" integer NOT NULL DEFAULT 0,
    "FailCount" integer NOT NULL DEFAULT 0,
    "Status" character varying(50) NOT NULL,
    "ErrorDetails" text,
    "DeviceId" uuid NOT NULL,
    "CreatedAt" timestamp without time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp without time zone,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_PunchImportBatches" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PunchImportBatches_BiometricDevices_DeviceId" FOREIGN KEY ("DeviceId")
        REFERENCES "BiometricDevices" ("Id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_PunchImportBatches_DeviceId" ON "PunchImportBatches" ("DeviceId");

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260321000000_AddPhase3to5', '8.0.25'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260321000000_AddPhase3to5');
