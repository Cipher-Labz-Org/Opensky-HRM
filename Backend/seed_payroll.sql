-- ============================================================
-- Payroll Schema Fix + Seed Script
-- Adds missing columns, creates missing tables, seeds components,
-- and marks the EnhancePayrollModule migration as applied.
-- ============================================================

BEGIN;

-- 1. CompensationComponents: add missing columns
ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "Category" text NOT NULL DEFAULT '';
ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "FormulaExpression" text;
ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "DependsOnComponentCode" text;
ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "IsEmployerContribution" boolean NOT NULL DEFAULT false;
ALTER TABLE "CompensationComponents" ADD COLUMN IF NOT EXISTS "SortOrder" integer NOT NULL DEFAULT 0;

-- 2. PayrollBatches: add missing columns
ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "ApprovedBy" varchar(200);
ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "Notes" varchar(1000);
ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "TotalDeductions" numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollBatches" ADD COLUMN IF NOT EXISTS "TotalEmployerCost" numeric(18,2) NOT NULL DEFAULT 0;

-- 3. PayStatements: add missing columns, alter types
ALTER TABLE "PayStatements" ADD COLUMN IF NOT EXISTS "BasicPay" numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayStatements" ADD COLUMN IF NOT EXISTS "TotalEarnings" numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayStatements" ADD COLUMN IF NOT EXISTS "TotalDeductions" numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayStatements" ADD COLUMN IF NOT EXISTS "EmployerCost" numeric(18,2) NOT NULL DEFAULT 0;

-- 4. SalaryRevisions: add missing columns
ALTER TABLE "SalaryRevisions" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp without time zone;
ALTER TABLE "SalaryRevisions" ADD COLUMN IF NOT EXISTS "ApprovedBy" text;
ALTER TABLE "SalaryRevisions" ADD COLUMN IF NOT EXISTS "Remarks" text;

-- 5. Create PayStatementLines table
CREATE TABLE IF NOT EXISTS "PayStatementLines" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "PayStatementId" uuid NOT NULL,
    "ComponentId" uuid NOT NULL,
    "ComponentCode" varchar(50) NOT NULL DEFAULT '',
    "ComponentName" varchar(200) NOT NULL DEFAULT '',
    "Type" varchar(30) NOT NULL DEFAULT '',
    "Amount" numeric(18,2) NOT NULL DEFAULT 0,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "CreatedBy" text,
    "UpdatedBy" text,
    CONSTRAINT "PK_PayStatementLines" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PayStatementLines_PayStatements_PayStatementId" FOREIGN KEY ("PayStatementId") REFERENCES "PayStatements" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PayStatementLines_CompensationComponents_ComponentId" FOREIGN KEY ("ComponentId") REFERENCES "CompensationComponents" ("Id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IX_PayStatementLines_PayStatementId" ON "PayStatementLines" ("PayStatementId");
CREATE INDEX IF NOT EXISTS "IX_PayStatementLines_ComponentId" ON "PayStatementLines" ("ComponentId");

-- 6. Create PayrollFormulas table
CREATE TABLE IF NOT EXISTS "PayrollFormulas" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Name" varchar(200) NOT NULL DEFAULT '',
    "Expression" text NOT NULL DEFAULT '',
    "ComponentCode" varchar(50) NOT NULL DEFAULT '',
    "Description" text,
    "Priority" integer NOT NULL DEFAULT 0,
    "IsActive" boolean NOT NULL DEFAULT true,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "CreatedBy" text,
    "UpdatedBy" text,
    CONSTRAINT "PK_PayrollFormulas" PRIMARY KEY ("Id")
);

-- 7. Mark migration as applied (if not already)
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260323131321_EnhancePayrollModule', '8.0.2'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260323131321_EnhancePayrollModule'
);

-- ============================================================
-- 8. Seed common payroll components (skip if data exists)
-- ============================================================
INSERT INTO "CompensationComponents" ("Id","Name","Code","Type","Category","IsTaxable","IsStatutory","IsEmployerContribution","SortOrder","Description","IsActive","IsDeleted","CreatedAt","UpdatedAt")
SELECT * FROM (VALUES
  (gen_random_uuid(),'Basic Salary','BASIC','Earning','Fixed',true,false,false,10,'Monthly basic salary',true,false,now(),now()),
  (gen_random_uuid(),'Transport Allowance','TA','Earning','Fixed',true,false,false,20,'Monthly transport / travel allowance',true,false,now(),now()),
  (gen_random_uuid(),'Meal Allowance','MEAL','Earning','Fixed',false,false,false,30,'Daily meal / food allowance',true,false,now(),now()),
  (gen_random_uuid(),'Housing Allowance','HOUSING','Earning','Fixed',true,false,false,40,'Monthly housing / rent allowance',true,false,now(),now()),
  (gen_random_uuid(),'Communication Allowance','COMM','Earning','Fixed',false,false,false,50,'Phone and internet allowance',true,false,now(),now()),
  (gen_random_uuid(),'Medical Allowance','MEDICAL','Earning','Fixed',false,false,false,60,'Monthly medical / health allowance',true,false,now(),now()),
  (gen_random_uuid(),'Attendance Allowance','ATTEND','Earning','Fixed',true,false,false,70,'Allowance for full attendance',true,false,now(),now()),
  (gen_random_uuid(),'Overtime','OT','Earning','Variable',true,false,false,100,'Overtime pay for additional hours',true,false,now(),now()),
  (gen_random_uuid(),'Commission','COMMISSION','Earning','Variable',true,false,false,110,'Sales commission',true,false,now(),now()),
  (gen_random_uuid(),'Incentive','INCENTIVE','Earning','Variable',true,false,false,120,'Performance incentive payment',true,false,now(),now()),
  (gen_random_uuid(),'Bonus','BONUS','Earning','OneTime',true,false,false,200,'Annual or special bonus',true,false,now(),now()),
  (gen_random_uuid(),'Festival Advance','FESTIVAL','Earning','OneTime',false,false,false,210,'Festival advance',true,false,now(),now()),
  (gen_random_uuid(),'Loan Deduction','LOAN','Deduction','Fixed',false,false,false,300,'Monthly loan repayment deduction',true,false,now(),now()),
  (gen_random_uuid(),'No-Pay Deduction','NOPAY','Deduction','Variable',false,false,false,310,'Deduction for no-pay leave days',true,false,now(),now()),
  (gen_random_uuid(),'Salary Advance','ADVANCE','Deduction','Variable',false,false,false,320,'Salary advance recovery',true,false,now(),now()),
  (gen_random_uuid(),'Insurance Premium','INSURANCE','Deduction','Fixed',false,false,false,330,'Employee insurance premium deduction',true,false,now(),now()),
  (gen_random_uuid(),'EPF - Employee 8%','EPF_EE','StatutoryDeduction','Statutory',false,true,false,900,'EPF employee contribution (8%)',true,false,now(),now()),
  (gen_random_uuid(),'EPF - Employer 12%','EPF_ER','StatutoryContribution','Statutory',false,true,true,910,'EPF employer contribution (12%)',true,false,now(),now()),
  (gen_random_uuid(),'ETF - Employer 3%','ETF_ER','StatutoryContribution','Statutory',false,true,true,920,'ETF employer contribution (3%)',true,false,now(),now())
) AS v("Id","Name","Code","Type","Category","IsTaxable","IsStatutory","IsEmployerContribution","SortOrder","Description","IsActive","IsDeleted","CreatedAt","UpdatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "CompensationComponents" LIMIT 1);

-- 9. Seed default EPF/ETF rates
INSERT INTO "SystemSettings" ("Key","Value","Description")
VALUES ('Payroll_EPF_EmployeeRate','0.08','EPF employee contribution rate')
ON CONFLICT ("Key") DO NOTHING;

INSERT INTO "SystemSettings" ("Key","Value","Description")
VALUES ('Payroll_EPF_EmployerRate','0.12','EPF employer contribution rate')
ON CONFLICT ("Key") DO NOTHING;

INSERT INTO "SystemSettings" ("Key","Value","Description")
VALUES ('Payroll_ETF_EmployerRate','0.03','ETF employer contribution rate')
ON CONFLICT ("Key") DO NOTHING;

COMMIT;
