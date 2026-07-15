export type TemplateKind = "email" | "letter";

export type TemplateMeta = {
  module: string;
  category: string;
  description: string;
  trigger: string;
  recipients: string[];
  senderProfile?: string;
  defaultSamples: Record<string, string>;
  /** Plain-text body for easy editing (emails / letters). */
  defaultBody?: string;
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
    defaultBody: `Hi {{EmployeeName}},

Your leave application has been submitted successfully and is now {{Status}}.

Leave type: {{LeaveTypeName}}
Start: {{StartDate}}
End: {{EndDate}}
Total days: {{TotalDays}}
Reason: {{Reason}}

You will be notified when your request is approved or rejected. If you have questions, contact HR.`,
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
      CompanyName: "OpenSky HRM",
    },
    defaultBody: `Dear {{CandidateName}},

We are pleased to extend an offer of employment for the position of {{PositionTitle}}. We were impressed with your qualifications and believe you will be a valuable addition to our team.

Position: {{PositionTitle}}
Salary: {{SalaryFormatted}}
Proposed joining date: {{JoiningDate}}

Please review the details and let us know your decision at your earliest convenience.

Best regards,
Human Resources
{{CompanyName}}`,
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
    defaultBody: `Hi {{CandidateName}},

You have been scheduled for an interview for {{RequisitionTitle}}.

Session: {{InterviewTitle}}
When: {{ScheduledAt}}
Duration: {{DurationMinutes}} minutes
Type: {{InterviewType}}
Location: {{Location}}
Interviewer: {{InterviewerName}}

If you need to reschedule, please contact HR.`,
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
    defaultBody: `Hi {{InterviewerName}},

You are scheduled to interview {{CandidateName}} for {{RequisitionTitle}}.

Session: {{InterviewTitle}}
When: {{ScheduledAt}}
Duration: {{DurationMinutes}} minutes
Type: {{InterviewType}}
Location: {{Location}}

Please review the candidate in OpenSky HRM before the session.`,
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
      JoinDate: "June 1, 2025",
      ProbationEndDate: "December 1, 2025",
      DateOfPermanency: "December 2, 2025",
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
      FirstName: "Alex",
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
      Location: "Colombo Head Office",
      JoinDate: "January 10, 2022",
      TerminationDate: "July 31, 2026",
      ManagerName: "Jordan Lee",
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
      BusinessUnit: "Technology",
      Location: "Colombo Head Office",
      Grade: "L3",
      ManagerName: "Jordan Lee",
      JoinDate: "June 1, 2026",
      Status: "Probation",
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
      Location: "Colombo Head Office",
      JoinDate: "June 1, 2025",
      Status: "Confirmed",
      ManagerName: "Jordan Lee",
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
      Position: "Software Engineer",
      Department: "Engineering",
      BusinessUnit: "Technology",
      Location: "Colombo Head Office",
      Grade: "L3",
      ManagerName: "Jordan Lee",
      JoinDate: "June 1, 2026",
      ProbationEndDate: "December 1, 2026",
      Status: "Probation",
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

  const templateModule = inferModule(templateKey, kind);
  return {
    module: templateModule,
    category: inferCategory(templateKey),
    description: kind === "email" ? `Transactional email: ${name}.` : `Employee letter: ${name}.`,
    trigger: kind === "email" ? "Sent automatically when the related HR event occurs." : "Generated from People → Create Document.",
    recipients: kind === "email" ? ["Employee"] : ["Employee"],
    senderProfile: kind === "email" ? "OpenSky HRM notifications" : undefined,
    defaultSamples: {
      RecipientName: "Alex Morgan",
      EmployeeName: "Alex Morgan",
      CompanyName: "OpenSky HRM",
      CurrentDate: "June 22, 2026",
    },
    defaultBody:
      kind === "email"
        ? `Hi {{RecipientName}},

I hope you are doing well.

Write your message in this space.

Thank you,
{{CompanyName}}`
        : `Dear {{EmployeeName}},

Write your letter in this space.

Sincerely,
{{CompanyName}}`,
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

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTagsLoose(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function extractBalancedDivInner(html: string, openIndex: number, openTagLength: number): string | null {
  let depth = 1;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openIndex + openTagLength;
  let t: RegExpExecArray | null;
  while ((t = tagRe.exec(html))) {
    if (/^<\/div/i.test(t[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(openIndex + openTagLength, t.index);
  }
  return null;
}

/** Prefer the email content card (padding block), not the gradient header. */
function extractEmailContentRegion(html: string): string | null {
  const openRe = /<div\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html))) {
    const attrs = m[1] ?? "";
    const style = attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    if (/linear-gradient/i.test(style)) continue;
    if (!/padding:\s*(28|32)px/i.test(style)) continue;
    const inner = extractBalancedDivInner(html, m.index, m[0].length);
    if (inner && stripTagsLoose(inner).length > 20) return inner;
  }
  return null;
}

/**
 * Convert stored template HTML into plain text for the easy editor.
 * Strips CSS/shell chrome and keeps {{placeholders}}.
 */
export function htmlToEditableText(html: string, opts?: { preferredDefaultBody?: string }): string {
  let raw = html.trim();
  if (!raw) return opts?.preferredDefaultBody?.trim() ?? "";
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw;

  raw = raw
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  const bodyTextMatch = raw.match(
    /<div[^>]*class=["'][^"']*\bbody-text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  if (bodyTextMatch?.[1]) {
    raw = bodyTextMatch[1];
  } else {
    const emailRegion = extractEmailContentRegion(raw);
    if (emailRegion) raw = emailRegion;
  }

  // Table rows → Label: Value lines
  raw = raw.replace(
    /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
    (_full, a: string, b: string) => {
      const label = stripTagsLoose(a);
      const value = stripTagsLoose(b);
      if (!label && !value) return "\n";
      return `\n${label}: ${value}\n`;
    },
  );

  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  text = decodeBasicEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Drop leftover shell lines if extraction failed partially
  text = text
    .replace(/^OpenSky HRM\s*$/gim, "")
    .replace(/^This is an automated (message|email) from OpenSky HRM\.?.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const looksLikeShellOnly =
    !text ||
    text.length < 40 ||
    (!text.includes("{{") && text.split(/\n+/).filter(Boolean).length <= 2);

  if (looksLikeShellOnly && opts?.preferredDefaultBody?.trim()) {
    return opts.preferredDefaultBody.trim();
  }

  return text;
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

export function isLegacyLetterHtml(html: string): boolean {
  return (
    html.includes("details-table") ||
    html.includes('class="header"') ||
    !html.includes('data-letter-version="2"')
  );
}
