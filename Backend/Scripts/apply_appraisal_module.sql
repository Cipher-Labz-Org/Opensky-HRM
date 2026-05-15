-- ================================================================
-- 360-Degree Performance Appraisal Module - Database Migration
-- ================================================================

-- Rating Scales
CREATE TABLE IF NOT EXISTS "RatingScales" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "IsDefault" boolean NOT NULL DEFAULT false,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "RatingScaleItems" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Value" integer NOT NULL,
    "Label" character varying(100) NOT NULL,
    "Description" text,
    "Color" character varying(50),
    "RatingScaleId" uuid NOT NULL REFERENCES "RatingScales"("Id") ON DELETE CASCADE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Competencies
CREATE TABLE IF NOT EXISTS "CompetencyCategories" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "Competencies" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "CategoryId" uuid NOT NULL REFERENCES "CompetencyCategories"("Id") ON DELETE CASCADE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Appraisal Templates
CREATE TABLE IF NOT EXISTS "AppraisalTemplates" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL DEFAULT true,
    "RatingScaleId" uuid NOT NULL REFERENCES "RatingScales"("Id"),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "AppraisalTemplateSections" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "Weight" integer NOT NULL DEFAULT 0,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "TemplateId" uuid NOT NULL REFERENCES "AppraisalTemplates"("Id") ON DELETE CASCADE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "AppraisalTemplateSectionItems" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "Weight" integer NOT NULL DEFAULT 0,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "SectionId" uuid NOT NULL REFERENCES "AppraisalTemplateSections"("Id") ON DELETE CASCADE,
    "CompetencyId" uuid REFERENCES "Competencies"("Id"),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Appraisal Cycles
CREATE TABLE IF NOT EXISTS "AppraisalCycles" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Name" character varying(200) NOT NULL,
    "Description" text,
    "CycleType" character varying(50) NOT NULL DEFAULT 'Annual',
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "Phase" character varying(50) NOT NULL DEFAULT 'Draft',
    "IncludeSelfAssessment" boolean NOT NULL DEFAULT true,
    "IncludeManagerReview" boolean NOT NULL DEFAULT true,
    "IncludePeerReview" boolean NOT NULL DEFAULT false,
    "IncludeDirectReportReview" boolean NOT NULL DEFAULT false,
    "IncludeExternalReview" boolean NOT NULL DEFAULT false,
    "IncludeGoals" boolean NOT NULL DEFAULT true,
    "SelfWeight" integer NOT NULL DEFAULT 10,
    "ManagerWeight" integer NOT NULL DEFAULT 40,
    "PeerWeight" integer NOT NULL DEFAULT 25,
    "DirectReportWeight" integer NOT NULL DEFAULT 15,
    "ExternalWeight" integer NOT NULL DEFAULT 10,
    "SelfDeadline" timestamp with time zone,
    "ManagerDeadline" timestamp with time zone,
    "PeerDeadline" timestamp with time zone,
    "CompletionDeadline" timestamp with time zone,
    "TemplateId" uuid NOT NULL REFERENCES "AppraisalTemplates"("Id"),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Appraisals (per-employee per-cycle)
CREATE TABLE IF NOT EXISTS "Appraisals" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Status" character varying(50) NOT NULL DEFAULT 'NotStarted',
    "FinalRating" numeric,
    "FinalComments" text,
    "AcknowledgedAt" timestamp with time zone,
    "AcknowledgementComment" text,
    "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id"),
    "CycleId" uuid NOT NULL REFERENCES "AppraisalCycles"("Id") ON DELETE CASCADE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Appraisal Reviewers
CREATE TABLE IF NOT EXISTS "AppraisalReviewers" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "ReviewerType" character varying(50) NOT NULL DEFAULT 'Self',
    "Status" character varying(50) NOT NULL DEFAULT 'Pending',
    "OverallRating" numeric,
    "OverallComments" text,
    "SubmittedAt" timestamp with time zone,
    "AppraisalId" uuid NOT NULL REFERENCES "Appraisals"("Id") ON DELETE CASCADE,
    "ReviewerEmployeeId" uuid NOT NULL REFERENCES "Employees"("Id"),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Appraisal Response Items
CREATE TABLE IF NOT EXISTS "AppraisalResponseItems" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "RatingValue" integer,
    "Comment" text,
    "ReviewerId" uuid NOT NULL REFERENCES "AppraisalReviewers"("Id") ON DELETE CASCADE,
    "TemplateSectionItemId" uuid NOT NULL REFERENCES "AppraisalTemplateSectionItems"("Id"),
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp with time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false
);

-- Add appraisal-related columns to Goals
ALTER TABLE "Goals" ADD COLUMN IF NOT EXISTS "AppraisalCycleId" uuid REFERENCES "AppraisalCycles"("Id");
ALTER TABLE "Goals" ADD COLUMN IF NOT EXISTS "SelfRating" integer;
ALTER TABLE "Goals" ADD COLUMN IF NOT EXISTS "ManagerRating" integer;

-- Seed default 5-point rating scale
DO $$ 
DECLARE scale_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "RatingScales" WHERE "Name" = '5-Point Standard Scale') THEN
        scale_id := gen_random_uuid();
        INSERT INTO "RatingScales" ("Id", "Name", "Description", "IsDefault", "IsActive", "CreatedAt", "IsDeleted")
        VALUES (scale_id, '5-Point Standard Scale', 'Standard 1–5 performance rating scale', true, true, now(), false);

        INSERT INTO "RatingScaleItems" ("Id", "Value", "Label", "Description", "Color", "RatingScaleId", "CreatedAt", "IsDeleted") VALUES
        (gen_random_uuid(), 1, 'Unsatisfactory', 'Performance significantly below expectations', '#ef4444', scale_id, now(), false),
        (gen_random_uuid(), 2, 'Needs Improvement', 'Performance below expectations in key areas', '#f97316', scale_id, now(), false),
        (gen_random_uuid(), 3, 'Meets Expectations', 'Performance consistently meets job requirements', '#eab308', scale_id, now(), false),
        (gen_random_uuid(), 4, 'Exceeds Expectations', 'Performance frequently exceeds job requirements', '#22c55e', scale_id, now(), false),
        (gen_random_uuid(), 5, 'Outstanding', 'Exceptional performance that sets the standard', '#3b82f6', scale_id, now(), false);
    END IF;
END $$;

-- Seed default competency categories and competencies
DO $$
DECLARE cat_leadership uuid; cat_technical uuid; cat_interpersonal uuid; cat_organizational uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "CompetencyCategories" WHERE "Name" = 'Leadership') THEN
        cat_leadership := gen_random_uuid();
        cat_technical := gen_random_uuid();
        cat_interpersonal := gen_random_uuid();
        cat_organizational := gen_random_uuid();

        INSERT INTO "CompetencyCategories" ("Id", "Name", "Description", "SortOrder", "CreatedAt", "IsDeleted") VALUES
        (cat_leadership, 'Leadership', 'Leadership and management competencies', 1, now(), false),
        (cat_technical, 'Technical', 'Technical and functional competencies', 2, now(), false),
        (cat_interpersonal, 'Interpersonal', 'Communication and relationship competencies', 3, now(), false),
        (cat_organizational, 'Organizational', 'Planning and organizational competencies', 4, now(), false);

        INSERT INTO "Competencies" ("Id", "Name", "Description", "SortOrder", "CategoryId", "CreatedAt", "IsDeleted") VALUES
        (gen_random_uuid(), 'Strategic Thinking', 'Ability to develop long-term vision and strategy', 1, cat_leadership, now(), false),
        (gen_random_uuid(), 'Decision Making', 'Makes sound decisions under pressure', 2, cat_leadership, now(), false),
        (gen_random_uuid(), 'Team Development', 'Develops and empowers team members', 3, cat_leadership, now(), false),
        (gen_random_uuid(), 'Change Management', 'Leads and adapts to organizational change', 4, cat_leadership, now(), false),
        (gen_random_uuid(), 'Job Knowledge', 'Demonstrates expertise in role-specific areas', 1, cat_technical, now(), false),
        (gen_random_uuid(), 'Problem Solving', 'Analyzes issues and implements solutions', 2, cat_technical, now(), false),
        (gen_random_uuid(), 'Innovation', 'Generates creative ideas and approaches', 3, cat_technical, now(), false),
        (gen_random_uuid(), 'Quality of Work', 'Produces accurate, thorough, and reliable work', 4, cat_technical, now(), false),
        (gen_random_uuid(), 'Communication', 'Communicates clearly and effectively', 1, cat_interpersonal, now(), false),
        (gen_random_uuid(), 'Collaboration', 'Works effectively with others across teams', 2, cat_interpersonal, now(), false),
        (gen_random_uuid(), 'Customer Focus', 'Prioritizes internal and external customer needs', 3, cat_interpersonal, now(), false),
        (gen_random_uuid(), 'Conflict Resolution', 'Handles disagreements constructively', 4, cat_interpersonal, now(), false),
        (gen_random_uuid(), 'Time Management', 'Prioritizes and manages workload effectively', 1, cat_organizational, now(), false),
        (gen_random_uuid(), 'Planning & Organization', 'Plans and organizes work systematically', 2, cat_organizational, now(), false),
        (gen_random_uuid(), 'Accountability', 'Takes responsibility for actions and outcomes', 3, cat_organizational, now(), false),
        (gen_random_uuid(), 'Adaptability', 'Adjusts to new conditions and challenges', 4, cat_organizational, now(), false);
    END IF;
END $$;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260316000001_AddAppraisalModule', '8.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260316000001_AddAppraisalModule');
