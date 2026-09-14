export type HelpContentSection = {
  id: string;
  title: string;
  tabLabel?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type HelpContentDoc = {
  sections: HelpContentSection[];
};

function doc(sections: HelpContentSection[]): HelpContentDoc {
  return { sections };
}

/** Module-specific guide copy (People Hub uses a dedicated React panel). */
export const HELP_CONTENT_BY_SLUG: Record<string, HelpContentDoc> = {
  dashboard: doc([
    {
      id: "dash-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "The Dashboard is your home view in OpenSky HRM. It surfaces key workforce metrics, pending tasks, and shortcuts to the areas you use most.",
        "Tiles and charts reflect live data when the page loads. Use links within each widget to jump directly into People, Leave, Recruitment, or other modules.",
      ],
    },
    {
      id: "dash-tasks",
      title: "Tasks & notifications",
      tabLabel: "Tasks",
      paragraphs: [
        "Review assigned employee tasks and open items that need your attention. The header bell icon lists people-related notifications such as birthdays and compliance reminders.",
      ],
      bullets: [
        "Click a task row to open the related employee or workflow where permitted.",
        "Use the calendar icon in the header for quick access to Leave.",
      ],
    },
    {
      id: "dash-more",
      title: "More help",
      tabLabel: "More help",
      paragraphs: [
        "Open Help & guides from the sidebar for documentation on every module. If a widget or menu item is missing, your administrator may need to adjust roles or licensed modules.",
      ],
    },
  ]),
  "people-audit-trail": doc([
    {
      id: "pat-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "People audit trail records changes to employee and people-related data for compliance and troubleshooting.",
        "Use filters and search to narrow events by user, date, or entity when available.",
      ],
    },
    {
      id: "pat-usage",
      title: "Reviewing events",
      tabLabel: "Events",
      paragraphs: ["Each entry typically shows who made a change, when it occurred, and what was updated."],
      bullets: [
        "Export or print options may be available depending on your permissions.",
        "Pair audit review with People Hub when you need the current record for an employee.",
      ],
    },
  ]),
  "employee-360": doc([
    {
      id: "e360-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Employee 360 is a consolidated view of an employee record—job details, contact information, documents, and widgets such as birthdays and company notices.",
        "HR users with directory access can search for other employees; most users see their own profile by default.",
      ],
    },
    {
      id: "e360-nav",
      title: "Navigation",
      tabLabel: "Profiles",
      paragraphs: ["Use tabs or sections within the profile to move between personal, job, compensation, and related data."],
      bullets: [
        "Editing is limited to fields your role allows.",
        "For full directory management, use People Hub.",
      ],
    },
  ]),
  recruitment: doc([
    {
      id: "rec-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Recruitment manages job requisitions, candidates, and hiring stages from draft through offer.",
        "Create requisitions, attach skills and descriptions, then track applicants through your configured pipeline.",
      ],
    },
    {
      id: "rec-requisitions",
      title: "Requisitions",
      tabLabel: "Requisitions",
      paragraphs: ["Open a requisition to see status, headcount, hiring manager, and linked candidates."],
      bullets: ["Use filters on the list page to find open or closed requisitions.", "Duplicate or edit requisitions when your permissions allow."],
    },
    {
      id: "rec-candidates",
      title: "Candidates",
      tabLabel: "Candidates",
      paragraphs: ["Candidate profiles store application details, notes, and stage history."],
      bullets: ["Move candidates between stages to reflect your hiring process.", "Link successful hires to onboarding tasks where configured."],
    },
  ]),
  "employee-tasks": doc([
    {
      id: "et-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Employee Tasks lists onboarding, offboarding, and operational checklists assigned to employees or HR.",
        "Tasks may be created from templates tied to hiring events or manually assigned.",
      ],
    },
    {
      id: "et-complete",
      title: "Completing tasks",
      tabLabel: "Tasks",
      paragraphs: ["Mark items complete as work is finished. Overdue tasks are highlighted for follow-up."],
      bullets: ["Filter by status, assignee, or employee when available.", "Open the employee profile from a task row for context."],
    },
  ]),
  "employee-actions": doc([
    {
      id: "ea-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Employee Actions covers HR lifecycle events such as transfers, promotions, and other structured changes.",
        "Each action type may collect different fields and approval rules.",
      ],
    },
    {
      id: "ea-create",
      title: "Creating actions",
      tabLabel: "Actions",
      paragraphs: ["Choose an action type, select the employee, and complete required fields before submitting."],
      bullets: ["Some actions generate documents or notifications automatically.", "Review history on the employee profile when permitted."],
    },
  ]),
  leave: doc([
    {
      id: "leave-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Leave & Absence lets employees request time off and lets managers and HR approve or decline requests.",
        "Balances and leave types depend on policies configured in Policy & Settings.",
      ],
    },
    {
      id: "leave-request",
      title: "Requests",
      tabLabel: "Requests",
      paragraphs: ["Submit a new request by choosing leave type, dates, and optional notes or attachments."],
      bullets: ["Track status: pending, approved, rejected, or cancelled.", "Managers see team requests in their queue or on Approvals."],
    },
    {
      id: "leave-calendar",
      title: "Calendar",
      tabLabel: "Calendar",
      paragraphs: ["The team calendar shows who is away and helps avoid scheduling conflicts."],
    },
  ]),
  approvals: doc([
    {
      id: "ap-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Approvals is a central inbox for items that need your sign-off, including leave and attendance-related requests.",
        "Open each row to see details before approving or rejecting.",
      ],
    },
  ]),
  attendance: doc([
    {
      id: "att-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Time & Attendance covers clocking, shifts, schedules, and attendance reporting.",
        "Configuration in Policy & Settings defines rules, grace periods, and pay codes where applicable.",
      ],
    },
    {
      id: "att-clock",
      title: "Clocking & shifts",
      tabLabel: "Clocking",
      paragraphs: ["Employees clock in and out according to your organization setup—web, kiosk, or integrations."],
      bullets: ["Supervisors may correct or approve exceptions.", "Use reports for period totals and exceptions."],
    },
  ]),
  payroll: doc([
    {
      id: "pay-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Payroll supports pay runs, earnings, deductions, and employee payslips when the module is licensed.",
        "Ensure attendance and leave data is finalized before processing a run.",
      ],
    },
  ]),
  performance: doc([
    {
      id: "perf-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Performance manages goals, review cycles, and appraisals.",
        "Managers assign goals and complete reviews; employees may self-assess depending on policy.",
      ],
    },
  ]),
  learning: doc([
    {
      id: "learn-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Learning & Skills tracks courses, completions, and skill records for your workforce.",
        "Assign training from catalogs or ad-hoc courses as permitted.",
      ],
    },
  ]),
  reports: doc([
    {
      id: "rep-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Reports provides standard HR reports and exports. Filter by date, department, or other dimensions where supported.",
      ],
    },
  ]),
  "org-structure": doc([
    {
      id: "org-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Org Structure defines departments, locations, cost centers, and reporting hierarchy used across the system.",
        "Changes here affect dropdowns in People Hub, recruitment, and analytics.",
      ],
    },
  ]),
  analytics: doc([
    {
      id: "ana-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Analytics delivers executive dashboards and drill-down views on headcount, turnover, and other workforce metrics.",
      ],
    },
  ]),
  "company-profile": doc([
    {
      id: "cprof-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Company Profile is where administrators set the organization logo, legal details, default currency, and the mobile app connection QR.",
        "The logo appears in the sign-in circle. Changes may require elevated permissions.",
      ],
    },
  ]),
  settings: doc([
    {
      id: "set-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Policy & Settings is where administrators configure leave types, attendance rules, entitlements, and other tenant-wide options.",
        "Company logo and legal details live under Company Profile.",
        "Changes may require elevated permissions.",
      ],
    },
  ]),
  onboarding: doc([
    {
      id: "onb-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: ["Onboarding coordinates new-hire tasks, documents, and milestones from offer acceptance to day one."],
    },
  ]),
  offboarding: doc([
    {
      id: "off-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: ["Offboarding manages exit checklists, asset returns, and final HR steps when someone leaves."],
    },
  ]),
  administration: doc([
    {
      id: "adm-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Data Import / Export supports bulk upload of employees, leave balances, bank details, and logins using templates.",
        "Download templates, fill them in Excel, then upload and review validation results before committing.",
      ],
    },
  ]),
  "user-management": doc([
    {
      id: "um-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "User Management links application logins to employees and assigns roles that control module access.",
      ],
      bullets: ["Create users, reset passwords, and map roles.", "Align roles with licensed modules for your plan."],
    },
  ]),
  billing: doc([
    {
      id: "bill-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: ["Billing shows subscription and invoice information for your OpenSky HRM instance."],
    },
  ]),
  "email-templates": doc([
    {
      id: "etpl-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Email & letter templates define transactional content with merge fields for employee and company data.",
        "Preview and test templates before they are used in workflows.",
      ],
    },
  ]),
  "email-delivery-log": doc([
    {
      id: "edl-overview",
      title: "Overview",
      tabLabel: "Overview",
      paragraphs: [
        "Email delivery log lists messages sent by the system with delivery status for audit and support.",
      ],
    },
  ]),
};
