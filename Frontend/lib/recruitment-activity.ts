/** Human-readable recruitment activity line for dashboard / list views. */
export function formatRecruitmentActivityDescription(activity: {
  description: string;
  candidateName?: string | null;
}): string {
  const name = activity.candidateName?.trim();
  const description = activity.description?.trim() ?? "";
  if (!name) return description;
  if (/\bcandidate\b/i.test(description)) {
    return description.replace(/\bcandidate\b/gi, name);
  }
  if (description.toLowerCase().includes(name.toLowerCase())) return description;
  return `${name} — ${description}`;
}
