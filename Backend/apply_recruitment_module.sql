-- =====================================================
-- Recruitment Module Migration
-- Adds new columns to Requisitions, Candidates, Interviews, Offers
-- Creates InterviewScorecards and CandidateActivities tables
-- =====================================================

-- ── Requisitions: new columns ────────────────────────
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "EmploymentType" TEXT;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "ExperienceMin" INTEGER;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "ExperienceMax" INTEGER;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SalaryMin" NUMERIC;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "SalaryMax" NUMERIC;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "Skills" TEXT;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "ClosedAt" TIMESTAMP;
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "LocationId" UUID REFERENCES "Locations"("Id");
ALTER TABLE "Requisitions" ADD COLUMN IF NOT EXISTS "PositionId" UUID REFERENCES "Positions"("Id");

-- ── Candidates: new columns ─────────────────────────
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "AppliedAt" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "CurrentTitle" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "CurrentCompany" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "ExpectedSalary" NUMERIC;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "NoticePeriod" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "Notes" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "Rating" INTEGER;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "RejectionReason" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "Tags" TEXT;
ALTER TABLE "Candidates" ADD COLUMN IF NOT EXISTS "EmployeeId" UUID REFERENCES "Employees"("Id");

-- ── Interviews: new columns ─────────────────────────
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "Title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "Duration" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "Location" TEXT;
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "Status" TEXT NOT NULL DEFAULT 'Scheduled';
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "OverallRating" INTEGER;
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "Recommendation" TEXT;
ALTER TABLE "Interviews" ADD COLUMN IF NOT EXISTS "InterviewerId" UUID REFERENCES "Employees"("Id");

-- ── Offers: new columns ─────────────────────────────
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "JoiningDate" TIMESTAMP;
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "OfferLetterUrl" TEXT;
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "AcceptedAt" TIMESTAMP;
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "RejectedAt" TIMESTAMP;
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "RejectionReason" TEXT;
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "PositionId" UUID REFERENCES "Positions"("Id");
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "JobTitleId" UUID REFERENCES "JobTitles"("Id");
ALTER TABLE "Offers" ADD COLUMN IF NOT EXISTS "DepartmentId" UUID REFERENCES "Departments"("Id");

-- ── InterviewScorecards (new table) ─────────────────
CREATE TABLE IF NOT EXISTS "InterviewScorecards" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Criteria" TEXT NOT NULL,
    "Rating" INTEGER NOT NULL,
    "Comment" TEXT,
    "InterviewId" UUID NOT NULL REFERENCES "Interviews"("Id") ON DELETE CASCADE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedBy" TEXT,
    "UpdatedBy" TEXT
);

-- ── CandidateActivities (new table) ─────────────────
CREATE TABLE IF NOT EXISTS "CandidateActivities" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ActivityType" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "PerformedBy" TEXT,
    "PerformedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "CandidateId" UUID NOT NULL REFERENCES "Candidates"("Id") ON DELETE CASCADE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "IX_InterviewScorecards_InterviewId" ON "InterviewScorecards" ("InterviewId");
CREATE INDEX IF NOT EXISTS "IX_CandidateActivities_CandidateId" ON "CandidateActivities" ("CandidateId");
CREATE INDEX IF NOT EXISTS "IX_Candidates_Stage" ON "Candidates" ("Stage");
CREATE INDEX IF NOT EXISTS "IX_Candidates_RequisitionId" ON "Candidates" ("RequisitionId");
CREATE INDEX IF NOT EXISTS "IX_Interviews_CandidateId" ON "Interviews" ("CandidateId");
CREATE INDEX IF NOT EXISTS "IX_Interviews_ScheduledAt" ON "Interviews" ("ScheduledAt");
CREATE INDEX IF NOT EXISTS "IX_Requisitions_Status" ON "Requisitions" ("Status");

-- ── Record migration ────────────────────────────────
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260316000000_RecruitmentModule', '9.0.0'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260316000000_RecruitmentModule'
);
