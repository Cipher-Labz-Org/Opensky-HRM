ALTER TABLE "OffboardingTaskTemplates" ADD COLUMN IF NOT EXISTS "AssignmentType" character varying(20) NOT NULL DEFAULT 'User';
ALTER TABLE "OffboardingTasks" ADD COLUMN IF NOT EXISTS "AssignmentType" character varying(20) NOT NULL DEFAULT 'User';
