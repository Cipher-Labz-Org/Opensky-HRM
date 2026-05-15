ALTER TABLE "OffboardingTasks" ADD COLUMN IF NOT EXISTS "CreatedBy" text NULL;
ALTER TABLE "OffboardingTasks" ADD COLUMN IF NOT EXISTS "UpdatedBy" text NULL;
