-- 1. Create EmploymentStatusTypes lookup table
CREATE TABLE IF NOT EXISTS "EmploymentStatusTypes" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "Name" text NOT NULL,
    "Code" text NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL DEFAULT true,
    "IsSystem" boolean NOT NULL DEFAULT false,
    "SortOrder" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    "UpdatedAt" timestamp without time zone,
    "CreatedBy" text,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_EmploymentStatusTypes" PRIMARY KEY ("Id")
);

-- 2. Seed default status types (only if table is empty)
INSERT INTO "EmploymentStatusTypes" ("Id","Name","Code","IsActive","IsSystem","SortOrder","CreatedAt","IsDeleted")
SELECT gen_random_uuid(), v."Name", v."Code", true, true, v."Ord", now(), false
FROM (VALUES
    ('Full Time Permanent','FullTimePermanent',1),
    ('Full Time Probation','FullTimeProbation',2),
    ('Full Time Contract','FullTimeContract',3),
    ('Full Time Internship','FullTimeInternship',4),
    ('Part Time Permanent','PartTimePermanent',5),
    ('Part Time Contract','PartTimeContract',6),
    ('Part Time Internship','PartTimeInternship',7),
    ('Freelance','Freelance',8),
    ('Terminated','Terminated',9)
) AS v("Name","Code","Ord")
WHERE NOT EXISTS (SELECT 1 FROM "EmploymentStatusTypes" LIMIT 1);

-- 3. Widen Employee.Status column from varchar(20) to varchar(50) if needed
ALTER TABLE "Employees" ALTER COLUMN "Status" TYPE character varying(50);

-- 4. Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId","ProductVersion")
SELECT '20260316000001_AddEmploymentStatusTypes','8.0.2'
WHERE NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260316000001_AddEmploymentStatusTypes'
);
