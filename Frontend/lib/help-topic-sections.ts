/**
 * Rich help sections for /app/help/[topic] — same structure as People Hub (cards + in-page nav).
 * Use **double asterisks** around phrases to render bold.
 */

export type HelpRichSection = {
  id: string;
  /** Label in the horizontal jump row (defaults to `title`) */
  navLabel?: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const HELP_TOPIC_SECTIONS: Record<string, HelpRichSection[]> = {
  dashboard: [
    {
      id: "overview",
      navLabel: "Overview",
      title: "Overview",
      paragraphs: [
        "The **Dashboard** is your landing page after sign-in. It surfaces key workforce signals, quick links to other modules, and anything that needs attention (depending on your role and licensed areas).",
        "Numbers and charts usually reflect the last successful load. After large imports or payroll runs elsewhere, **refresh** the page if totals look out of date.",
      ],
    },
    {
      id: "tiles",
      navLabel: "Tiles",
      title: "Summary tiles & KPIs",
      paragraphs: [
        "Tiles often show counts or trends (for example headcount, leave in flight, or attendance exceptions). **Click a tile** when it behaves as a shortcut—many jump straight into the related module with a sensible default view.",
      ],
      bullets: [
        "Hover or subtitles on tiles may explain the date range or filter used.",
        "If a tile is missing entirely, your plan may not include that module—check with your administrator.",
      ],
    },
    {
      id: "navigation",
      navLabel: "Shortcuts",
      title: "Shortcuts & deep links",
      paragraphs: [
        "Use the **sidebar** for the full module list. The dashboard complements that with **frequent actions** so managers and HR can reach Leave, People, or Reports in one click.",
      ],
    },
    {
      id: "access",
      navLabel: "Access",
      title: "Who sees what",
      bullets: [
        "**Role and permissions** control which tiles and links appear.",
        "Employees often see a lighter dashboard than HR or admins.",
      ],
    },
  ],

  "people-audit-trail": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "The **People audit trail** lists changes tied to employee and directory data—useful for compliance, investigations, and answering “who changed this?”.",
      ],
    },
    {
      id: "reading",
      navLabel: "Reading",
      title: "Reading the log",
      paragraphs: [
        "Each row typically describes **what** changed, **which employee** (if applicable), **when**, and **which user** performed the action.",
      ],
      bullets: [
        "Open a row or detail panel when the UI offers it for **before/after** values.",
        "Use **sorting** on date columns to work from newest backwards.",
      ],
    },
    {
      id: "filters",
      title: "Filters & export",
      paragraphs: [
        "Narrow by **date range**, actor, or entity when filters are available. If **export** is offered, use your organization’s retention policy for downloaded files.",
      ],
    },
  ],

  "employee-360": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Employee 360** is the consolidated view of a person’s HR record: job, reporting, compensation-related fields where enabled, documents, and related workflows.",
      ],
    },
    {
      id: "own-vs-others",
      navLabel: "Scope",
      title: "Your profile vs others",
      bullets: [
        "Many users land on **their own** summary first.",
        "HR and managers with broader **People** scope can search or open other employees from here or via **People Hub**.",
      ],
    },
    {
      id: "tabs",
      navLabel: "Tabs",
      title: "Tabs & sections",
      paragraphs: [
        "Information is grouped into **tabs or panels**. Read-only fields appear disabled or without an edit affordance.",
      ],
    },
    {
      id: "editing",
      title: "Editing & saving",
      paragraphs: [
        "Only change fields you are allowed to edit. After edits, use **Save** (or the page’s primary action). If validation fails, fix highlighted fields before saving again.",
      ],
    },
  ],

  recruitment: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Recruitment** covers requisitions, candidates, interviews, and hiring stages so HR and hiring managers can run a pipeline in one place.",
      ],
    },
    {
      id: "requisitions",
      navLabel: "Requisitions",
      title: "Requisitions",
      paragraphs: [
        "Create or open a **requisition** to define the role, headcount, and approval path. Status chips show whether a req is draft, approved, on hold, or closed.",
      ],
      bullets: [
        "Link the requisition to **department and location** when prompted so downstream reporting stays accurate.",
      ],
    },
    {
      id: "candidates",
      navLabel: "Candidates",
      title: "Candidates & pipeline",
      paragraphs: [
        "Add **candidates** and move them through your configured stages. Attach CVs and notes so the panel has full context.",
      ],
    },
    {
      id: "hired",
      navLabel: "Hired",
      title: "From offer to People Hub",
      paragraphs: [
        "When someone is **hired**, complete any onboarding handoff your process defines. The new employee should appear in **People Hub** after data sync—use search if you don’t see them immediately.",
      ],
    },
  ],

  "employee-tasks": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Employee Tasks** gathers work items that span hiring and people operations—approvals, data checks, and follow-ups assigned to you or your team.",
      ],
    },
    {
      id: "inbox",
      navLabel: "Inbox",
      title: "Working your inbox",
      bullets: [
        "Open a task to see **instructions**, due dates, and any linked employee or requisition.",
        "Use **Complete** or the workflow button your tenant uses; some tasks reopen if validation fails.",
      ],
    },
    {
      id: "filters",
      title: "Filters & delegation",
      paragraphs: [
        "Filter by **status** or **assignee** when lists grow. Reassign only when your policy allows it.",
      ],
    },
  ],

  "employee-actions": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Employee Actions** drive lifecycle events—confirmations, transfers, promotions, exits, and similar HR-controlled changes—with structured forms instead of ad-hoc spreadsheets.",
      ],
    },
    {
      id: "start",
      navLabel: "Start",
      title: "Starting an action",
      bullets: [
        "Choose the **action type** first; the form fields adapt to that type.",
        "Select the **employee** the action applies to; dependent fields may load from their current job record.",
      ],
    },
    {
      id: "documents",
      navLabel: "Documents",
      title: "Attachments & approvals",
      paragraphs: [
        "Upload **supporting documents** when the template requires them. Submit for **approval** if your workflow shows an approver chain—track status from the same module.",
      ],
    },
  ],

  leave: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Leave & Absence** is where employees request time off, managers approve, and HR monitors balances and calendar impact.",
      ],
    },
    {
      id: "request",
      navLabel: "Request",
      title: "Submitting a request",
      bullets: [
        "Pick **leave type**, **start/end dates** (or half-days if enabled), and enter a **reason** when mandatory.",
        "The system may show **projected balance**—treat it as guidance until the request is approved.",
      ],
    },
    {
      id: "approval",
      navLabel: "Approval",
      title: "Approvals",
      paragraphs: [
        "Approvers see **pending items** in their queue. **Approve** or **reject** with a comment when comments are required by policy.",
      ],
    },
    {
      id: "calendar",
      navLabel: "Calendar",
      title: "Calendar & team view",
      paragraphs: [
        "Use the **calendar** to spot overlaps, holidays, or blackout periods. Managers often review team leave before peak periods.",
      ],
    },
  ],

  attendance: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Time & Attendance** captures worked time—via devices, imports, or manual entry depending on configuration—and supports corrections and period reporting.",
      ],
    },
    {
      id: "recording",
      navLabel: "Recording",
      title: "Recording time",
      bullets: [
        "Follow the method your company enabled: **clock in/out**, **timesheet**, or **imported punches**.",
        "If a punch looks wrong, use the **correction** flow instead of duplicating entries.",
      ],
    },
    {
      id: "exceptions",
      navLabel: "Exceptions",
      title: "Exceptions & approvals",
      paragraphs: [
        "Managers review **missed punches**, **late arrivals**, or **overtime** according to local rules. Only approve corrections you can justify.",
      ],
    },
    {
      id: "reports",
      navLabel: "Reports",
      title: "Period close & payroll",
      paragraphs: [
        "Run **period** or **daily** summaries before payroll cutoff. Export only to approved destinations.",
      ],
    },
  ],

  payroll: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Payroll** brings together pay periods, earnings, deductions, and payslip publication. Exact screens depend on your integration (in-product vs export).",
      ],
    },
    {
      id: "prepare",
      navLabel: "Prepare",
      title: "Preparing a run",
      bullets: [
        "Validate **new hires**, **terminations**, and **leave without pay** before locking a period.",
        "Resolve **attendance** exceptions that feed gross pay.",
      ],
    },
    {
      id: "process",
      navLabel: "Process",
      title: "Processing & review",
      paragraphs: [
        "Use **preview** or **simulation** steps when available. Double-check totals for a small sample of employees before full commit.",
      ],
    },
    {
      id: "payslips",
      navLabel: "Payslips",
      title: "Payslips & employee access",
      paragraphs: [
        "After you **publish** payslips, employees can usually open them from their profile or self-service area. Republish only through supported correction workflows.",
      ],
    },
  ],

  performance: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Performance** hosts goals, review cycles, and appraisals so feedback is structured, dated, and auditable.",
      ],
    },
    {
      id: "cycles",
      navLabel: "Cycles",
      title: "Cycles & deadlines",
      bullets: [
        "Open the **active cycle** from the landing view.",
        "Watch **due dates** for self-assessment and manager review—late submissions may lock after the deadline.",
      ],
    },
    {
      id: "reviews",
      navLabel: "Reviews",
      title: "Writing reviews",
      paragraphs: [
        "Answer **rating scales** and **narrative prompts** honestly. Save drafts if offered; **Submit** when you are ready for the next step in the chain.",
      ],
    },
    {
      id: "hr",
      navLabel: "HR",
      title: "HR monitoring",
      paragraphs: [
        "HR can track **completion rates** by department or manager and send reminders where the product allows.",
      ],
    },
  ],

  learning: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Learning & Skills** tracks courses, completions, and sometimes skills matrices so development isn’t lost in email threads.",
      ],
    },
    {
      id: "enroll",
      navLabel: "Enroll",
      title: "Enrollment",
      bullets: [
        "**Self-enroll** where enabled, or wait for a manager/HR assignment.",
        "Confirm **prerequisites** before starting content that builds on earlier modules.",
      ],
    },
    {
      id: "complete",
      navLabel: "Complete",
      title: "Completion & proof",
      paragraphs: [
        "Mark **complete** only when you finished the required material. Some courses track progress automatically.",
      ],
    },
    {
      id: "team",
      navLabel: "Team",
      title: "Team visibility",
      paragraphs: [
        "Managers may see **team progress** dashboards—use them for 1:1 conversations, not as a surveillance scorecard unless policy says otherwise.",
      ],
    },
  ],

  reports: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Reports** delivers standard HR extracts—headcount, turnover, leave balances, and more—parameterized by date and organization scope.",
      ],
    },
    {
      id: "parameters",
      navLabel: "Parameters",
      title: "Parameters",
      bullets: [
        "Set **date from/to** carefully; inclusive vs exclusive ranges differ by report.",
        "Filter by **department, location, or job** when those dimensions exist.",
      ],
    },
    {
      id: "run",
      navLabel: "Run",
      title: "Running & exporting",
      paragraphs: [
        "Click **Run** or **Generate**, then **export** to Excel or PDF if offered. Large extracts may take a moment—avoid double-clicking run.",
      ],
    },
    {
      id: "data",
      navLabel: "Data",
      title: "Data protection",
      paragraphs: [
        "Reports can contain **personal data**. Store downloads on approved drives and share only with people who have a business need.",
      ],
    },
  ],

  "org-structure": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Org Structure** visualizes reporting lines, positions, and hierarchy. It helps HR maintain the chart and helps managers understand spans of control.",
      ],
    },
    {
      id: "browse",
      navLabel: "Browse",
      title: "Browsing the tree",
      bullets: [
        "**Expand** nodes to walk the hierarchy.",
        "Use **search** when the tree is large to jump to a person or unit.",
      ],
    },
    {
      id: "edit",
      navLabel: "Edit",
      title: "Maintenance & impact",
      paragraphs: [
        "Editing is restricted to users with **structure maintenance** rights. Changes can affect **approval chains** and **visibility** elsewhere—plan edits during quiet windows when possible.",
      ],
    },
  ],

  analytics: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Analytics** provides dashboards and visual exploration of workforce metrics—turnover risk, diversity slices, productivity proxies (where configured), and trends over time.",
      ],
    },
    {
      id: "filters",
      navLabel: "Filters",
      title: "Filters & cohorts",
      bullets: [
        "Apply **global filters** (period, business unit, location) before interpreting charts.",
        "Small cohorts can look volatile—read the **sample size** or footnotes when shown.",
      ],
    },
    {
      id: "drill",
      navLabel: "Drill",
      title: "Drill-down",
      paragraphs: [
        "Click **chart segments** when drill-down is enabled to see underlying lists—export only if your role allows.",
      ],
    },
  ],

  settings: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Policy & Settings** is the administrative home for company profile, branding, policies, and many cross-cutting options that affect every user.",
      ],
    },
    {
      id: "company",
      navLabel: "Company",
      title: "Company & branding",
      bullets: [
        "Update **legal name**, **addresses**, and **contact** details used on documents.",
        "Upload **logo** assets in the formats requested; oversized images may be rejected.",
      ],
    },
    {
      id: "risk",
      navLabel: "Care",
      title: "Changes with wide impact",
      paragraphs: [
        "Some toggles apply **immediately** to all users. Read confirmation dialogs. Prefer **test accounts** when experimenting with unfamiliar options.",
      ],
    },
    {
      id: "related",
      navLabel: "Related",
      title: "Related areas",
      paragraphs: [
        "Use **Email & letter templates** and **Email delivery log** from the sidebar for communications configuration and troubleshooting.",
      ],
    },
  ],

  billing: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Billing** shows subscription or entitlement information for tenant administrators. Day-to-day HR tasks stay in other modules.",
      ],
    },
    {
      id: "plan",
      navLabel: "Plan",
      title: "Plan & usage",
      bullets: [
        "Review **included modules** and any **usage meters** displayed.",
        "Note the **renewal date** and billing contacts on the page.",
      ],
    },
    {
      id: "changes",
      title: "Upgrades & invoices",
      paragraphs: [
        "For **upgrades**, new modules, or invoice copies, follow the **Contact** or support path your organization uses with OpenSky.",
      ],
    },
  ],

  "email-templates": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Email & letter templates** define the wording sent by workflows—offers, reminders, and HR letters—merged with employee and company fields.",
      ],
    },
    {
      id: "editor",
      navLabel: "Editor",
      title: "Editing templates",
      bullets: [
        "Use **placeholders** exactly as documented (case and braces matter).",
        "Preview with **sample data** when available before saving.",
      ],
    },
    {
      id: "test",
      navLabel: "Test",
      title: "Test sends",
      paragraphs: [
        "Send a **test message** to yourself or a sandbox mailbox. Avoid spamming real employees during edits.",
      ],
    },
  ],

  "email-delivery-log": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "The **Email delivery log** lists outbound messages with status from the mail provider—use it when someone says “I never got the email.”",
      ],
    },
    {
      id: "search",
      navLabel: "Search",
      title: "Finding a message",
      bullets: [
        "Filter by **date range** and **recipient**.",
        "Search subject or template name if those fields exist.",
      ],
    },
    {
      id: "status",
      navLabel: "Status",
      title: "Status codes",
      paragraphs: [
        "Open a row for **bounce** or **error** text. Soft bounces may retry; hard bounces need a corrected address.",
      ],
    },
  ],

  administration: [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**Data Import / Export** is for administrators moving structured employee or reference data in bulk. Always match the **template version** your tenant expects.",
      ],
    },
    {
      id: "template",
      navLabel: "Template",
      title: "Templates & validation",
      bullets: [
        "Download the **latest** CSV/Excel template before each run.",
        "Validate **required columns** and **codes** (departments, locations) locally to reduce failed rows.",
      ],
    },
    {
      id: "upload",
      navLabel: "Upload",
      title: "Upload & summary",
      paragraphs: [
        "After upload, read the **summary**: inserted, updated, skipped, and **error rows**. Fix the file and re-import failed lines when the tool supports partial retry.",
      ],
    },
    {
      id: "safety",
      navLabel: "Safety",
      title: "Safety & environments",
      paragraphs: [
        "Never load **production** data into a **test** tenant without approval. Imports can overwrite live fields.",
      ],
    },
  ],

  "user-management": [
    {
      id: "overview",
      title: "Overview",
      paragraphs: [
        "**User Management** controls who can sign in to OpenSky HRM, which **roles** they receive, and how accounts link to **employee records**.",
      ],
    },
    {
      id: "create",
      navLabel: "Create",
      title: "Creating users",
      bullets: [
        "Assign the **smallest role set** that still lets the person do their job.",
        "Use a **verified email** for password reset and notifications.",
      ],
    },
    {
      id: "link",
      navLabel: "Link",
      title: "Linking to employees",
      paragraphs: [
        "Link accounts to **employee profiles** when self-service or approvals depend on identity. Wrong links can expose the wrong record—double-check employee codes.",
      ],
    },
    {
      id: "offboard",
      navLabel: "Offboard",
      title: "Deactivation",
      paragraphs: [
        "**Deactivate** users who leave the organization instead of deleting history. Reactivate only with proper approvals.",
      ],
    },
  ],
};
