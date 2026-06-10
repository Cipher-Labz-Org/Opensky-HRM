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
