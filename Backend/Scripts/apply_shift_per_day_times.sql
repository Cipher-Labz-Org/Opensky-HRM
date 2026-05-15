-- Migration: Replace half-day flags with per-day start/end times on ShiftPatterns
-- Date: 2026-03-16
-- Allows custom hours per weekday (e.g. 7h or 4h on specific days).

-- Drop half-day columns
ALTER TABLE "ShiftPatterns"
  DROP COLUMN IF EXISTS "HalfDayMonday",
  DROP COLUMN IF EXISTS "HalfDayTuesday",
  DROP COLUMN IF EXISTS "HalfDayWednesday",
  DROP COLUMN IF EXISTS "HalfDayThursday",
  DROP COLUMN IF EXISTS "HalfDayFriday",
  DROP COLUMN IF EXISTS "HalfDaySaturday",
  DROP COLUMN IF EXISTS "HalfDaySunday";

-- Add per-day start/end time overrides (nullable; when set, override default shift times for that day)
ALTER TABLE "ShiftPatterns"
  ADD COLUMN IF NOT EXISTS "MondayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "MondayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "TuesdayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "TuesdayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "WednesdayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "WednesdayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "ThursdayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "ThursdayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "FridayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "FridayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "SaturdayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "SaturdayEndTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "SundayStartTime" interval NULL,
  ADD COLUMN IF NOT EXISTS "SundayEndTime" interval NULL;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260316000001_ShiftPerDayTimes', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
