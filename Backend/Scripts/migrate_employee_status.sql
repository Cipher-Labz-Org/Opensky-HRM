-- ============================================================
-- Split Employee Status into Status (lifecycle) + EmploymentType
-- ============================================================

BEGIN;

-- 1. Rename current "Status" column to "EmploymentType"
ALTER TABLE "Employees" RENAME COLUMN "Status" TO "EmploymentType";

-- 2. Add new "Status" column (lifecycle) with default 'Active'
ALTER TABLE "Employees" ADD COLUMN "Status" varchar(50) NOT NULL DEFAULT 'Active';

-- 3. Migrate data: employees whose EmploymentType was 'Terminated' get Status = 'Terminated'
UPDATE "Employees" SET "Status" = 'Terminated' WHERE "EmploymentType" = 'Terminated';

-- 4. Fix EmploymentType for terminated employees (restore to FullTimePermanent)
UPDATE "Employees" SET "EmploymentType" = 'FullTimePermanent' WHERE "EmploymentType" = 'Terminated';

-- 5. Create EmployeeStatusTypes master data table
CREATE TABLE IF NOT EXISTS "EmployeeStatusTypes" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Name" varchar(100) NOT NULL,
    "Code" varchar(50) NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL DEFAULT true,
    "IsSystem" boolean NOT NULL DEFAULT false,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "CreatedBy" text,
    "UpdatedBy" text,
    CONSTRAINT "PK_EmployeeStatusTypes" PRIMARY KEY ("Id")
);

-- 6. Seed default employee status values
INSERT INTO "EmployeeStatusTypes" ("Id","Code","Name","Description","IsActive","IsSystem","SortOrder","IsDeleted","CreatedAt","UpdatedAt")
VALUES
  (gen_random_uuid(), 'Active',    'Active',    'Currently employed and working',     true, true, 10, false, now(), now()),
  (gen_random_uuid(), 'OnNotice',  'On Notice', 'Serving notice period',              true, true, 20, false, now(), now()),
  (gen_random_uuid(), 'Resigned',  'Resigned',  'Voluntarily left the organization',  true, true, 30, false, now(), now()),
  (gen_random_uuid(), 'Terminated','Terminated', 'Employment terminated by employer',  true, true, 40, false, now(), now()),
  (gen_random_uuid(), 'Retired',   'Retired',   'Retired from service',               true, true, 50, false, now(), now()),
  (gen_random_uuid(), 'Deceased',  'Deceased',  'Employee is deceased',               true, true, 60, false, now(), now()),
  (gen_random_uuid(), 'Absconded', 'Absconded', 'Left without notice',               true, true, 70, false, now(), now());

COMMIT;
