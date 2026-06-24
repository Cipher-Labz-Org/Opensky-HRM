-- OpenSkyHRM: Customer Transaction Data Reset
-- WARNING: This script deletes customer operational/transactional data.
-- Recommended: take a full DB backup before running.
--
-- Safety guard:
-- - This script refuses to run on databases whose name contains 'prod' or 'production'
--   unless you explicitly allow it by setting a Postgres session parameter:
--     SET openskyhrm_reset_allow = 'true';
--
-- Example (psql):
--   SET openskyhrm_reset_allow = 'true';
--   \i reset_customer_transaction_data.sql

DO $$
BEGIN
  IF (current_database() ILIKE '%prod%' OR current_database() ILIKE '%production%') THEN
    IF current_setting('openskyhrm_reset_allow', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Refusing to run on production-like database "%". Set openskyhrm_reset_allow = ''true'' to override.',
        current_database();
    END IF;
  END IF;
END $$;

BEGIN;

-- Keep system users (including admin) even when clearing employee data.
-- Detach user->employee link. We do NOT TRUNCATE Employees because Users has an FK to Employees.
UPDATE "Users" SET "EmployeeId" = NULL WHERE "EmployeeId" IS NOT NULL;

-- Transactional purge (aligned with CustomerTransactionPurgeMatrix.TransactionTables)
TRUNCATE TABLE
  "EmployeeAttachments",
  "EmployeeSupervisors",
  "EmergencyContacts",
  "Dependents",
  "Educations",
  "EmployeeSkills",
  "EmployeeLanguages",
  "EmployeeBenefits",
  "Immigrations",
  "ImmigrationDocuments",
  "WorkExperiences",
  "BankAccounts",

  "LeaveRequests",
  "LeaveBalances",
  "LeaveMonthlyAccruals",
  "AttendanceRecords",
  "RosterAssignments",
  "PunchImportBatches",

  "Requisitions",
  "Candidates",
  "Interviews",
  "Offers",
  "InterviewScorecards",
  "CandidateActivities",

  "OnboardingTasks",
  "OnboardingMilestones",
  "OffboardingTasks",

  "EmployeeCompensations",
  "SalaryRevisions",
  "PayrollBatches",
  "PayStatements",
  "PayStatementLines",

  "Goals",
  "ReviewCycles",
  "PerformanceReviews",
  "Appraisals",
  "AppraisalReviewers",
  "AppraisalResponseItems",
  "AppraisalCycles",

  "TrainingAssignments",
  "EmployeeCertifications",
  "SkillMatrices",

  "SuccessionPlans",

  "AnalyticsSnapshotCaches",
  "AuditLogs",
  "OutboundEmailLogs"
RESTART IDENTITY CASCADE;

-- Clear employees last (DELETE works with FK constraints; TRUNCATE would require truncating Users too).
DELETE FROM "Employees";

-- Keep only the primary admin user account (username = 'admin').
DELETE FROM "UserRoles" ur
USING "Users" u
WHERE ur."UserId" = u."Id"
  AND lower(u."Username") <> 'admin';

DELETE FROM "Users"
WHERE lower("Username") <> 'admin';

-- Optional: purge Hangfire runtime data.
-- We truncate all base tables in the 'Hangfire' or 'hangfire' schema if they exist.
DO $$
DECLARE
  s text;
  stmt text;
BEGIN
  FOREACH s IN ARRAY ARRAY['Hangfire','hangfire'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      SELECT
        'TRUNCATE TABLE ' ||
        string_agg(format('%I.%I', table_schema, table_name), ', ') ||
        ' RESTART IDENTITY CASCADE;'
      INTO stmt
      FROM information_schema.tables
      WHERE table_schema = s
        AND table_type = 'BASE TABLE';

      IF stmt IS NOT NULL THEN
        EXECUTE stmt;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Post-check: ensure transactional tables are empty.
-- (Keep this at the end so it doesn't clutter the main transactional section.)
-- SELECT COUNT(*) FROM "Employees";

