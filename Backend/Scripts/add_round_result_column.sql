-- Adds the payroll "Round result" column when a tenant DB predates the
-- AddCompensationComponentRoundResult migration. Without it the API cannot
-- persist the per-component rounding choice, so the calculation engine
-- evaluates every formula unrounded and payslips drift from Employee Salary.
ALTER TABLE "CompensationComponents"
    ADD COLUMN IF NOT EXISTS "RoundResult" boolean NOT NULL DEFAULT FALSE;
