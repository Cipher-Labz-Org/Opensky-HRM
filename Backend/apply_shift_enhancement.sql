-- Shift Enhancement: Add new columns to ShiftPatterns
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "ShiftType" character varying(20) NOT NULL DEFAULT 'Regular';
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "Session2StartTime" interval;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "Session2EndTime" interval;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "FlexiWindowStart" interval;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "FlexiWindowEnd" interval;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "MinimumWorkHours" numeric;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "LateGraceMinutes" integer NOT NULL DEFAULT 5;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "EarlyDepartureGraceMinutes" integer NOT NULL DEFAULT 5;
ALTER TABLE "ShiftPatterns" ADD COLUMN IF NOT EXISTS "HalfDayHours" integer NOT NULL DEFAULT 4;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260321100000_EnhanceShiftPattern', '8.0.25'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260321100000_EnhanceShiftPattern');
