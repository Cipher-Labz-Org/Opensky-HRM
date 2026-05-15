-- Add AssignedToUserId to OffboardingTasks
ALTER TABLE "OffboardingTasks" ADD COLUMN IF NOT EXISTS "AssignedToUserId" uuid NULL;

-- Create OffboardingTaskTemplates table
CREATE TABLE IF NOT EXISTS "OffboardingTaskTemplates" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Title" character varying(200) NOT NULL,
    "Description" text NULL,
    "Category" character varying(100) NOT NULL,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "IsActive" boolean NOT NULL DEFAULT true,
    "AssignedToUserId" uuid NULL,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "CreatedBy" text NULL,
    "UpdatedAt" timestamp without time zone NULL,
    "UpdatedBy" text NULL,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_OffboardingTaskTemplates" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OffboardingTaskTemplates_Users_AssignedToUserId" FOREIGN KEY ("AssignedToUserId") REFERENCES "Users" ("Id")
);
CREATE INDEX IF NOT EXISTS "IX_OffboardingTaskTemplates_AssignedToUserId" ON "OffboardingTaskTemplates" ("AssignedToUserId");
