const FIELD_LABELS: Record<string, string> = {
  Title: "Title",
  Code: "Code",
  DepartmentId: "Department",
  JobTitleId: "Job title",
  LocationId: "Location",
  HiringManagerId: "Hiring manager",
  Vacancies: "Vacancies",
  ApplicationNotificationEmail: "Application notification email",
  Email: "Email",
  FirstName: "First name",
  LastName: "Last name",
  Username: "Username",
  Password: "Password",
};

function labelForField(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function humanizeFieldMessage(field: string, message: string): string {
  const label = labelForField(field);
  const lower = message.toLowerCase();
  if (lower.includes("required") || lower.includes("must not be empty")) {
    return `${label} is required`;
  }
  if (
    lower.includes("not a valid") ||
    lower.includes("could not be converted") ||
    lower.includes("invalid guid") ||
    lower.includes("format is not valid")
  ) {
    return `${label} must be selected or entered correctly`;
  }
  if (message.includes(field)) {
    return message.replace(field, label);
  }
  return `${label}: ${message}`;
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
        ? `API route not found (${endpoint}). Deploy the latest backend to ${base} and recycle IIS.`
        : `Resource not found on ${base}. Check ${base}/health.`;
    }
    if (status === 502 || status === 503 || status === 504) {
      return `Cannot reach ${base} (${status}). Open ${base}/health — if it fails, recycle the IIS app pool.`;
    }
    if (status >= 500) {
      return title
        ? `Server error (${status}): ${title}. Check ${base}/health and IIS logs.`
        : `Server error (${status}) from ${base}. Check ${base}/health and recycle the IIS app pool.`;
    }
    return title
      ? `Unexpected response from ${base} (${status}): ${title}`
      : `Unexpected response from ${base} (${status}). Check ${base}/health.`;
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
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail.trim();
    if (typeof parsed.title === "string" && parsed.title.trim()) return parsed.title.trim();
  } catch {
    /* fall through */
  }

  if (status === 404 && !trimmed) {
    return endpoint
      ? `API 404: no route for ${endpoint}. Deploy the latest API to ${base}.`
      : `API 404 on ${base}.`;
  }
  if (status >= 500 && !trimmed) {
    return `The server failed while processing this request (${status}). Check ${base}/health and server logs.`;
  }
  if (trimmed) return trimmed.slice(0, 280);
  if (status === 401) return "Invalid username or password.";
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
  if (errorEntries && typeof errorEntries === "object") {
    const parts: string[] = [];
    for (const [field, raw] of Object.entries(errorEntries)) {
      const messages = Array.isArray(raw) ? raw : [raw];
      for (const msg of messages) {
        if (typeof msg === "string" && msg.trim()) {
          parts.push(humanizeFieldMessage(field, msg.trim()));
        }
      }
    }
    if (parts.length > 0) {
      return `Please fix the following: ${parts.join("; ")}.`;
    }
  }

  if (typeof parsed.message === "string" && parsed.message.trim()) {
    const msg = parsed.message.trim();
    if (!/^one or more validation errors occurred\.?$/i.test(msg)) return msg;
  }

  if (typeof parsed.detail === "string" && parsed.detail.trim()) {
    return parsed.detail.trim();
  }

  if (typeof parsed.title === "string" && parsed.title.trim()) {
    const title = parsed.title.trim();
    if (!/^one or more validation errors occurred\.?$/i.test(title)) return title;
  }

  return null;
}
