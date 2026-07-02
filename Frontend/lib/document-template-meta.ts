export type TemplateKind = "email" | "letter";

export type TemplateMeta = {
  module: string;
  category: string;
  description: string;
  trigger: string;
  recipients: string[];
  senderProfile?: string;
  defaultSamples: Record<string, string>;
};

const META: Record<string, TemplateMeta> = {
  Email_LeaveApplication: {
    module: "Leave",
    category: "Confirmation",
    description: "Confirms that a leave request was submitted and shows summary details.",
    trigger: "Employee submits a leave application in Leave & Absence.",
    recipients: ["Employee"],
    senderProfile: "OpenSky HRM notifications",
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      Status: "Pending approval",
      LeaveTypeName: "Annual leave",
      StartDate: "July 1, 2026",
      EndDate: "July 5, 2026",
      TotalDays: "5",
      Reason: "Family vacation",
    },
  },
  Email_RecruitmentOffer: {
    module: "Recruitment",
    category: "Offer",
    description: "Offer of employment sent to a selected candidate.",
    trigger: "HR sends an offer from Recruitment after final approval.",
    recipients: ["Candidate"],
    senderProfile: "Human Resources · OpenSky HRM",
    defaultSamples: {
      CandidateName: "Jordan Lee",
      PositionTitle: "Senior Software Engineer",
      SalaryFormatted: "LKR 250,000 / month",
      JoiningDate: "August 1, 2026",
      RemarksHtml: "",
    },
  },
  Email_RecruitmentInterviewCandidate: {
    module: "Recruitment",
    category: "Interview",
    description: "Interview invitation and schedule details for the candidate.",
    trigger: "An interview is scheduled in Recruitment.",
    recipients: ["Candidate"],
    senderProfile: "OpenSky HRM notifications",
    defaultSamples: {
      CandidateName: "Jordan Lee",
      RequisitionTitle: "Senior Software Engineer",
      InterviewTitle: "Technical interview",
      ScheduledAt: "July 15, 2026 · 10:00 AM",
      DurationMinutes: "60",
      InterviewType: "In person",
      Location: "Head office · Room 3A",
      InterviewerName: "Sam Patel",
    },
  },
  Email_RecruitmentInterviewInterviewer: {
    module: "Recruitment",
    category: "Interview",
    description: "Interview assignment and schedule details for the interviewer.",
    trigger: "An interview is scheduled in Recruitment.",
    recipients: ["Interviewer"],
    senderProfile: "OpenSky HRM notifications",
    defaultSamples: {
      InterviewerName: "Sam Patel",
      CandidateName: "Jordan Lee",
      RequisitionTitle: "Senior Software Engineer",
      InterviewTitle: "Technical interview",
      ScheduledAt: "July 15, 2026 · 10:00 AM",
      DurationMinutes: "60",
      InterviewType: "In person",
      Location: "Head office · Room 3A",
    },
  },
  job_confirmation: {
    module: "People",
    category: "Onboarding",
    description: "Formal job confirmation letter for a new hire.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      Location: "Colombo",
      JoinDate: "June 1, 2026",
      Status: "Active",
      ManagerName: "Sam Patel",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  probation_confirmation: {
    module: "People",
    category: "Confirmation",
    description: "Probation completion confirmation letter.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  experience_letter: {
    module: "People",
    category: "Separation",
    description: "Experience / service letter for a departing employee.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      JoinDate: "January 10, 2022",
      TerminationDate: "June 30, 2026",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  resignation_letter: {
    module: "People",
    category: "Separation",
    description: "Employee resignation acknowledgement letter.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  appointment_letter: {
    module: "People",
    category: "Onboarding",
    description: "Appointment letter for a newly hired employee.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      JoinDate: "June 1, 2026",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  confirmation_letter: {
    module: "People",
    category: "Confirmation",
    description: "Permanent employment confirmation letter.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
  contract_letter: {
    module: "People",
    category: "Contract",
    description: "Employment contract letter template.",
    trigger: "Generated from People → Create Document.",
    recipients: ["Employee"],
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      EmployeeCode: "EMP-0042",
      JobTitle: "Software Engineer",
      Department: "Engineering",
      JoinDate: "June 1, 2026",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  },
};

function inferModule(templateKey: string, kind: TemplateKind): string {
  if (templateKey.startsWith("Email_Recruitment")) return "Recruitment";
  if (templateKey.startsWith("Email_Leave")) return "Leave";
  if (templateKey.startsWith("Email_")) return "Notifications";
  return kind === "email" ? "Notifications" : "People";
}

function inferCategory(templateKey: string): string {
  const key = templateKey.toLowerCase();
  if (key.includes("offer")) return "Offer";
  if (key.includes("interview")) return "Interview";
  if (key.includes("leave")) return "Confirmation";
  if (key.includes("resignation") || key.includes("experience")) return "Separation";
  if (key.includes("appointment") || key.includes("job_confirmation")) return "Onboarding";
  if (key.includes("confirmation")) return "Confirmation";
  if (key.includes("contract")) return "Contract";
  return "General";
}

export function getTemplateMeta(templateKey: string, kind: TemplateKind, name: string): TemplateMeta {
  const known = META[templateKey];
  if (known) return known;

  const module = inferModule(templateKey, kind);
  return {
    module,
    category: inferCategory(templateKey),
    description: kind === "email" ? `Transactional email: ${name}.` : `Employee letter: ${name}.`,
    trigger: kind === "email" ? "Sent automatically when the related HR event occurs." : "Generated from People → Create Document.",
    recipients: kind === "email" ? ["Employee"] : ["Employee"],
    senderProfile: kind === "email" ? "OpenSky HRM notifications" : undefined,
    defaultSamples: {
      EmployeeName: "Alex Morgan",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
  };
}

export function extractPlaceholders(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\{\{(\w+)\}\}/g)) {
    found.add(match[1]);
  }
  return [...found].sort();
}

export function applyPlaceholders(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildDefaultSamples(html: string, templateKey: string, kind: TemplateKind, name: string): Record<string, string> {
  const meta = getTemplateMeta(templateKey, kind, name);
  const placeholders = extractPlaceholders(html);
  const samples: Record<string, string> = { ...meta.defaultSamples };
  for (const key of placeholders) {
    if (!(key in samples)) samples[key] = `[${key}]`;
  }
  return samples;
}
