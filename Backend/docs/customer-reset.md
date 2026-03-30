# Customer Transaction Data Reset (Onboarding Runbook)

This runbook clears **transactional/customer operational data** so you can onboard a **new customer** using the same OpenSkyHRM database.

It intentionally **keeps** master/reference catalogs and configuration tables (licensing catalog, permissions, settings, templates, etc.).

## Prerequisites

1. Take a full DB backup (or snapshot) before resetting.
2. Ensure you have an authenticated operator/admin token (JWT) with permissions for `Administration:Delete`.
3. Configure the confirmation phrase used by the API reset endpoint:
   - Set an environment variable for `.NET configuration` key `CustomerReset:ConfirmPhrase`
   - Default phrase if unset: `ERASE CUSTOMER DATA`
   - In PowerShell you can use:
     - `setx CustomerReset__ConfirmPhrase "ERASE CUSTOMER DATA"`
4. (Recommended) Configure the bootstrap admin password used after reset:
   - `.NET configuration` key `CustomerReset:BootstrapAdminPassword` (env var `CustomerReset__BootstrapAdminPassword`)
   - Default if unset: `Admin@123`

## Option A: One-off SQL reset (recommended for initial customer cutover)

1. In `psql` (or your DB admin tool), set the production guard override only if needed:
   - `SET openskyhrm_reset_allow = 'true';`
2. Run:
   - `\i reset_customer_transaction_data.sql`
3. Start (or restart) the API.
   - The API runs EF migrations and ensures the baseline licensing catalog automatically.

Verification (suggested):
- Confirm transactional tables are empty (example):
  - `SELECT COUNT(*) FROM "Employees";`
  - `SELECT COUNT(*) FROM "LeaveRequests";`

## Option B: In-app reset API (dry-run + execute)

### 1) Dry-run (preview counts)

`POST /api/admin/customer-reset`

Request body:
```json
{
  "dryRun": true,
  "allowInProduction": false,
  "includeHangfire": true,
  "confirmPhrase": "OPTIONAL_FOR_DRY_RUN"
}
```

Response includes per-table row counts that would be purged.

### 2) Execute reset (destructive)

Request body:
```json
{
  "dryRun": false,
  "allowInProduction": false,
  "includeHangfire": true,
  "confirmPhrase": "<YOUR CustomerReset:ConfirmPhrase>"
}
```

Notes:
- `allowInProduction` must be `true` when running in a production environment.
- The endpoint also enforces:
  - licensing: `Administration`
  - permission: `Administration:Delete`

## What gets cleared?

Cleared transactional tables include (not exhaustive):
- Employee lifecycle records (employees, dependents, skills, attachments, etc.)
- Leave requests, balances, monthly accruals
- Attendance and punch import batches
- Recruitment pipeline records (requisitions, candidates, interviews, offers)
- Onboarding/offboarding task instances
- Payroll/compensation instances and statements
- Performance/appraisal instances
- Learning assignment records
- Operational analytics snapshots and audit/event logs
- Outbound email logs
- Hangfire runtime tables (optional, default `includeHangfire=true`)

## Post-reset checklist

1. Login and confirm Admin/HR Manager dashboards load.
2. Confirm “catalog” tables still have expected reference data (leave types, skills/courses, templates).
3. If you want new-customer-specific org structure, recreate it via the normal onboarding/admin endpoints (departments/business units, etc.).
4. Verify scheduled background jobs run successfully after reset.

