-- Create EmployeeTaskTemplates table
CREATE TABLE IF NOT EXISTS "EmployeeTaskTemplates" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text NULL,
    "Type" character varying(20) NOT NULL DEFAULT 'Offboarding',
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "CreatedBy" text NULL,
    "UpdatedAt" timestamp without time zone NULL,
    "UpdatedBy" text NULL,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_EmployeeTaskTemplates" PRIMARY KEY ("Id")
);

-- Create EmployeeTaskTemplateItems table
CREATE TABLE IF NOT EXISTS "EmployeeTaskTemplateItems" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Title" character varying(200) NOT NULL,
    "Description" text NULL,
    "Category" character varying(100) NOT NULL,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "AssignmentType" character varying(20) NOT NULL DEFAULT 'User',
    "AssignedToUserId" uuid NULL,
    "TemplateId" uuid NOT NULL,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "CreatedBy" text NULL,
    "UpdatedAt" timestamp without time zone NULL,
    "UpdatedBy" text NULL,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_EmployeeTaskTemplateItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_EmployeeTaskTemplateItems_EmployeeTaskTemplates_TemplateId" FOREIGN KEY ("TemplateId") REFERENCES "EmployeeTaskTemplates" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_EmployeeTaskTemplateItems_Users_AssignedToUserId" FOREIGN KEY ("AssignedToUserId") REFERENCES "Users" ("Id")
);

CREATE INDEX IF NOT EXISTS "IX_EmployeeTaskTemplateItems_TemplateId" ON "EmployeeTaskTemplateItems" ("TemplateId");
CREATE INDEX IF NOT EXISTS "IX_EmployeeTaskTemplateItems_AssignedToUserId" ON "EmployeeTaskTemplateItems" ("AssignedToUserId");

-- Add AssignmentType and AssignedToUserId to OnboardingTasks
ALTER TABLE "OnboardingTasks" ADD COLUMN IF NOT EXISTS "AssignmentType" character varying(20) NOT NULL DEFAULT 'User';
ALTER TABLE "OnboardingTasks" ADD COLUMN IF NOT EXISTS "AssignedToUserId" uuid NULL;

-- Migrate existing OffboardingTaskTemplates into a default EmployeeTaskTemplate
DO $$
DECLARE
    template_id uuid;
    has_items boolean;
BEGIN
    SELECT EXISTS(SELECT 1 FROM "OffboardingTaskTemplates" WHERE NOT "IsDeleted") INTO has_items;
    IF has_items THEN
        template_id := gen_random_uuid();
        INSERT INTO "EmployeeTaskTemplates" ("Id", "Name", "Description", "Type", "IsActive", "CreatedAt", "IsDeleted")
        VALUES (template_id, 'Standard Offboarding', 'Default offboarding tasks migrated from previous setup', 'Offboarding', true, now(), false);

        INSERT INTO "EmployeeTaskTemplateItems" ("Id", "Title", "Description", "Category", "SortOrder", "AssignmentType", "AssignedToUserId", "TemplateId", "CreatedAt", "IsDeleted")
        SELECT gen_random_uuid(), "Title", "Description", "Category", "SortOrder",
               COALESCE("AssignmentType", 'User'), "AssignedToUserId", template_id, now(), false
        FROM "OffboardingTaskTemplates"
        WHERE NOT "IsDeleted" AND "IsActive";
    END IF;
END $$;
