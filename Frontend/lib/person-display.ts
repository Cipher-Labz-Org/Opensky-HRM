/** Show only the first given name, e.g. "Romesh Chamal" → "Romesh". */
export function formatFirstNameOnly(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  if (!first) return first;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** "Romesh Chamal, ama Ranmini" → "Romesh, Ama" */
export function formatSupervisorFirstNames(supervisorNames: string | null | undefined): string {
  if (!supervisorNames?.trim()) return "—";
  return supervisorNames
    .split(",")
    .map((part) => formatFirstNameOnly(part))
    .filter(Boolean)
    .join(", ");
}
