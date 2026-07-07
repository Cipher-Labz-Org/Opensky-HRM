const PLACEHOLDER_DOMAIN = "@employee.noemail.opensky.hrm";

export function isPlaceholderWorkEmail(email: string | null | undefined): boolean {
  const trimmed = email?.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase().includes(PLACEHOLDER_DOMAIN.toLowerCase());
}

export function displayWorkEmail(email: string | null | undefined): string {
  const trimmed = email?.trim();
  if (!trimmed || isPlaceholderWorkEmail(trimmed)) return "";
  return trimmed;
}

/** Normalize work email before save — empty or placeholder becomes null. */
export function normalizeWorkEmailForSave(email: string | null | undefined): string | null {
  const display = displayWorkEmail(email);
  return display || null;
}
