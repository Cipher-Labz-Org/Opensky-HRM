-- 1. LeaveBalances: PeriodStart, PeriodEnd
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='LeaveBalances' AND column_name='PeriodStart') THEN
    ALTER TABLE "LeaveBalances" ADD COLUMN "PeriodStart" timestamp without time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='LeaveBalances' AND column_name='PeriodEnd') THEN
    ALTER TABLE "LeaveBalances" ADD COLUMN "PeriodEnd" timestamp without time zone;
  END IF;
END $$;

-- 2. Employees: ShiftPatternId
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Employees' AND column_name='ShiftPatternId') THEN
    ALTER TABLE "Employees" ADD COLUMN "ShiftPatternId" uuid;
    CREATE INDEX "IX_Employees_ShiftPatternId" ON "Employees" ("ShiftPatternId");
    ALTER TABLE "Employees" ADD CONSTRAINT "FK_Employees_ShiftPatterns_ShiftPatternId" FOREIGN KEY ("ShiftPatternId") REFERENCES "ShiftPatterns" ("Id") ON DELETE SET NULL;
  END IF;
END $$;

-- 3. RosterTemplates: DefaultShiftPatternId
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='RosterTemplates' AND column_name='DefaultShiftPatternId') THEN
    ALTER TABLE "RosterTemplates" ADD COLUMN "DefaultShiftPatternId" uuid;
    CREATE INDEX "IX_RosterTemplates_DefaultShiftPatternId" ON "RosterTemplates" ("DefaultShiftPatternId");
    ALTER TABLE "RosterTemplates" ADD CONSTRAINT "FK_RosterTemplates_ShiftPatterns_DefaultShiftPatternId" FOREIGN KEY ("DefaultShiftPatternId") REFERENCES "ShiftPatterns" ("Id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4. RosterAssignments table
CREATE TABLE IF NOT EXISTS "RosterAssignments" (
    "Id" uuid NOT NULL,
    "EffectiveFrom" timestamp without time zone NOT NULL,
    "EffectiveTo" timestamp without time zone,
    "Notes" text,
    "EmployeeId" uuid NOT NULL,
    "RosterTemplateId" uuid NOT NULL,
    "CreatedAt" timestamp without time zone NOT NULL,
    "UpdatedAt" timestamp without time zone,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "CreatedBy" text,
    "UpdatedBy" text,
    CONSTRAINT "PK_RosterAssignments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_RosterAssignments_Employees_EmployeeId" FOREIGN KEY ("EmployeeId") REFERENCES "Employees" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_RosterAssignments_RosterTemplates_RosterTemplateId" FOREIGN KEY ("RosterTemplateId") REFERENCES "RosterTemplates" ("Id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "IX_RosterAssignments_EmployeeId_EffectiveFrom" ON "RosterAssignments" ("EmployeeId", "EffectiveFrom");

-- 5. Record in migrations history so EF won't try to re-apply
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20260319073500_AddLeaveBalancePeriod', '8.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20260319100000_AddEmployeeShiftPatternId', '8.0.0') ON CONFLICT DO NOTHING;
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20260320120000_AddRosterAssignmentsAndTemplateShift', '8.0.0') ON CONFLICT DO NOTHING;
