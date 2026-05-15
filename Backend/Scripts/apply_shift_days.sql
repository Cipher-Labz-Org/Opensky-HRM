-- Migration: Add day-of-week applicability and half-day fields to ShiftPatterns
-- Date: 2026-03-16

-- Add day applicability columns (default: Mon-Fri = true, Sat-Sun = false)
ALTER TABLE "ShiftPatterns"
  ADD COLUMN IF NOT EXISTS "AppliesOnMonday" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "AppliesOnTuesday" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "AppliesOnWednesday" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "AppliesOnThursday" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "AppliesOnFriday" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "AppliesOnSaturday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "AppliesOnSunday" boolean NOT NULL DEFAULT false;

-- Add half-day columns (default: all false)
ALTER TABLE "ShiftPatterns"
  ADD COLUMN IF NOT EXISTS "HalfDayMonday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDayTuesday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDayWednesday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDayThursday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDayFriday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDaySaturday" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "HalfDaySunday" boolean NOT NULL DEFAULT false;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260316000000_AddShiftDayApplicability', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
