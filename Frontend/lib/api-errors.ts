const SKIP_FIELD_KEYS = new Set([
  "dto",
  "req",
  "request",
  "body",
  "$",
  "",
]);

const FIELD_LABELS: Record<string, string> = {
  employee: "Employee details",
  employeeCode: "Employee code",
  firstName: "First name",
  lastName: "Last name",
  middleName: "Middle name",
  email: "Email",
  phone: "Phone",
  otherEmail: "Other email",
  dateOfBirth: "Date of birth",
  joinDate: "Join date",
  terminationDate: "Termination date",
  probationEndDate: "Probation end date",
  dateOfPermanency: "Date of permanency",
  gender: "Gender",
  departmentId: "Department",
  department: "Department",
  jobTitleId: "Job title",
  jobTitle: "Job title",
  locationId: "Location",
  location: "Location",
  businessUnitId: "Business unit",
  businessUnit: "Business unit",
  gradeId: "Grade",
  grade: "Grade",
  positionId: "Position",
  position: "Position",
  managerId: "Manager",
  manager: "Manager",
  hiringManagerId: "Hiring manager",
  username: "Username",
  password: "Password",
  confirmPassword: "Confirm password",
  title: "Title",
  code: "Code",
  vacancies: "Vacancies",
  status: "Status",
  description: "Description",
  priority: "Priority",
  employmentType: "Employment type",
  targetDate: "Target date",
  applicationNotificationEmail: "Application notification email",
  nationalId: "National ID",
  tinNumber: "TIN number",
  epfNumber: "EPF number",
  etfNumber: "ETF number",
  driversLicenseNumber: "Driving licence number",
  licenseIssueDate: "Licence issue date",
  licenseExpiryDate: "Licence expiry date",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
  salaryCurrency: "Salary currency",
  experienceMin: "Minimum experience",
  experienceMax: "Maximum experience",
  skills: "Skills",
  requisitionId: "Requisition",
  candidateId: "Candidate",
  leaveTypeId: "Leave type",
  fromDate: "From date",
  toDate: "To date",
  startDate: "Start date",
  endDate: "End date",
  scheduledAt: "Scheduled date and time",
  duration: "Duration",
  amount: "Amount",
  currency: "Currency",
  roleId: "Role",
  roleIds: "Roles",
  templateId: "Template",
  onboardingTemplateId: "Onboarding template",
};

function normalizeFieldKey(raw: string): string | null {
  let field = raw.trim();
  if (!field) return null;

  field = field.replace(/^\$\.?/, "");
  field = field.replace(/^\$\['?([^'\]]+)'?\]$/, "$1");

  const segments = field.split(".").filter(Boolean);
  field = segments.length > 0 ? segments[segments.length - 1]! : field;

  if (SKIP_FIELD_KEYS.has(field.toLowerCase())) return null;
  return field;
}

function labelForField(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];

  const camelKey = field.charAt(0).toLowerCase() + field.slice(1);
  if (FIELD_LABELS[camelKey]) return FIELD_LABELS[camelKey];

  const withoutId = field.replace(/Id$/, "");
  if (FIELD_LABELS[withoutId]) return FIELD_LABELS[withoutId];

  return field
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function humanizeGenericMessage(message: string): string {
  return message
    .replace(/\$\.([A-Za-z][\w.]*)/g, (_, path: string) => {
      const leaf = path.split(".").pop() ?? path;
      return labelForField(leaf);
    })
    .replace(/\bdto\b/gi, "form")
    .replace(/\bjson\b/gi, "data")
    .trim();
}

function humanizeFieldMessage(field: string, message: string): string | null {
  const normalized = normalizeFieldKey(field);
  const cleanedMessage = humanizeGenericMessage(message.trim());
  const lower = cleanedMessage.toLowerCase();

  if (!normalized) {
    if (lower.includes("required")) return null;
    return cleanedMessage || null;
  }

  const label = labelForField(normalized);

  if (lower.includes("required") || lower.includes("must not be empty") || lower.includes("field is required")) {
    return `${label} is required`;
  }

  if (
    lower.includes("not a valid") ||
    lower.includes("could not be converted") ||
    lower.includes("invalid guid") ||
    lower.includes("format is not valid") ||
    lower.includes("must be selected or entered correctly") ||
    lower.includes("the json value could not be converted")
  ) {
    return `${label} must be selected or entered correctly`;
  }

  if (cleanedMessage.toLowerCase().includes(normalized.toLowerCase())) {
    return cleanedMessage.replace(new RegExp(normalized, "gi"), label);
  }

  return `${label}: ${cleanedMessage}`;
}

function buildValidationSummary(parts: string[]): string {
  const unique = [...new Set(parts.filter(Boolean))];
  if (unique.length === 0) return "Please complete all required fields and try again.";
  if (unique.length === 1) return unique[0]!;
  return `Please fix the following: ${unique.join("; ")}.`;
}

/** True when an HTTP body looks like an HTML error page (IIS, nginx, Vercel, etc.). */
export function looksLikeHtml(text: string): boolean {
  const sample = text.trimStart().slice(0, 160).toLowerCase();
  return (
    sample.startsWith("<!doctype") ||
    sample.startsWith("<html") ||
    sample.startsWith("<head") ||
    /<!doctype/i.test(sample)
  );
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || null;
}

export type HttpErrorContext = {
  status: number;
  endpoint?: string;
  backendUrl?: string | null;
};

/** Normalize any thrown/API error into a user-facing message. */
export function resolveErrorMessage(err: unknown, ctx?: Partial<HttpErrorContext>): string {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (!msg.startsWith("{")) return msg;
    try {
      const parsed = JSON.parse(msg) as { message?: string; errors?: Record<string, string[] | string> };
      const friendly = formatApiErrorBody(parsed);
      if (friendly) return friendly;
    } catch {
      /* fall through */
    }
    return msg;
  }
  return ctx?.status ? `Request failed (${ctx.status}).` : "Something went wrong. Please try again.";
}

/** Normalize any HTTP error body (JSON, plain text, or HTML) into a user-facing message. */
export function resolveHttpErrorMessage(text: string, ctx: HttpErrorContext): string {
  const { status, endpoint, backendUrl } = ctx;
  const trimmed = text.trim();
  const base = backendUrl?.replace(/\/$/, "") || "the HR API";

  if (/42P01|relation ["']?Instanc/i.test(trimmed)) {
    return "Database is missing licensing tables. Run EF migrations on the API database, then restart the API.";
  }

  if (looksLikeHtml(trimmed)) {
    const title = extractHtmlTitle(trimmed);
    if (status === 401) return "Invalid username or password.";
    if (status === 403) return "Access denied. Contact your administrator.";
    if (status === 404) {
      return endpoint
        ? `The requested item could not be found (${endpoint}).`
        : "The requested item could not be found.";
    }
    if (status === 502 || status === 503 || status === 504) {
      return "The server is temporarily unavailable. Please try again in a few minutes.";
    }
    if (status >= 500) {
      return title
        ? `A server error occurred (${status}). Please try again or contact support.`
        : "A server error occurred. Please try again or contact support.";
    }
    return title ? `Unexpected response (${status}): ${title}` : `Unexpected response (${status}).`;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      title?: string;
      detail?: string;
      errors?: Record<string, string[] | string>;
    };
    const friendly = formatApiErrorBody(parsed);
    if (friendly) return friendly;
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return humanizeGenericMessage(parsed.message.trim());
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return humanizeGenericMessage(parsed.detail.trim());
    }
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      return humanizeGenericMessage(parsed.title.trim());
    }
  } catch {
    /* fall through */
  }

  if (status === 404 && !trimmed) return "The requested item could not be found.";
  if (status >= 500 && !trimmed) return "A server error occurred. Please try again or contact support.";
  if (trimmed) return humanizeGenericMessage(trimmed.slice(0, 280));
  if (status === 401) return "Invalid username or password.";
  if (status === 403) return "You do not have permission to perform this action.";
  return `Request failed (${status}).`;
}

/** Turn ASP.NET ProblemDetails / validation payloads into a readable message. */
export function formatApiErrorBody(parsed: {
  message?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[] | string>;
}): string | null {
  const errorEntries = parsed.errors;
  const parts: string[] = [];

  if (errorEntries && typeof errorEntries === "object") {
    for (const [field, raw] of Object.entries(errorEntries)) {
      const messages = Array.isArray(raw) ? raw : [raw];
      for (const msg of messages) {
        if (typeof msg === "string" && msg.trim()) {
          const friendly = humanizeFieldMessage(field, msg.trim());
          if (friendly) parts.push(friendly);
        }
      }
    }
  }

  if (parts.length > 0) {
    return buildValidationSummary(parts);
  }

  if (typeof parsed.message === "string" && parsed.message.trim()) {
    const msg = humanizeGenericMessage(parsed.message.trim());
    if (!/^one or more validation errors occurred\.?$/i.test(msg)) {
      if (msg.toLowerCase().includes("required") && msg.toLowerCase().includes("dto")) {
        return "Please complete all required fields and try again.";
      }
      return msg;
    }
  }

  if (typeof parsed.detail === "string" && parsed.detail.trim()) {
    const detail = humanizeGenericMessage(parsed.detail.trim());
    if (!/^one or more validation errors occurred\.?$/i.test(detail)) return detail;
  }

  if (typeof parsed.title === "string" && parsed.title.trim()) {
    const title = humanizeGenericMessage(parsed.title.trim());
    if (!/^one or more validation errors occurred\.?$/i.test(title)) return title;
  }

  return null;
}
