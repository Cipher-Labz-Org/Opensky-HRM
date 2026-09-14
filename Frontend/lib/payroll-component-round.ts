const STORAGE_KEY = "opensky.payroll.componentRound";

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed)) {
      out[id] = value === true || value === "true" || value === 1;
    }
    return out;
  } catch {
    return {};
  }
}

export function apiRoundResultEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === "True" || value === 1;
}

export function setComponentRoundResult(id: string, round: boolean) {
  if (!id || typeof window === "undefined") return;
  const next = { ...readMap(), [id]: round };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function shouldRoundComponent(id: string | undefined, apiValue?: unknown): boolean {
  if (apiRoundResultEnabled(apiValue)) return true;
  if (!id) return false;
  return readMap()[id] === true;
}
