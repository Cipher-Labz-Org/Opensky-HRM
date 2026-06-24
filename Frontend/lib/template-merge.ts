const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Unique placeholder keys from one or more template strings (e.g. `{{CandidateName}}`). */
export function extractTemplatePlaceholders(...sources: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    for (const match of src.matchAll(PLACEHOLDER_RE)) {
      found.add(match[1]);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** Replace `{{Key}}` tokens with plain text (for labels and subject preview). */
export function applyTemplateMergePlain(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = values[key];
    return value != null && value.trim() !== "" ? value.trim() : `{{${key}}}`;
  });
}

/** Replace `{{Key}}` tokens for HTML/PDF output (values are HTML-escaped). */
export function applyTemplateMergeHtml(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = values[key];
    return value != null && value.trim() !== "" ? escapeHtml(value.trim()) : `{{${key}}}`;
  });
}

export function formatTemplateFieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildInitialMergeValues(keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, ""]));
}
