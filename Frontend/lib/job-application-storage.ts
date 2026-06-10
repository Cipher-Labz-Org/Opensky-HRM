export type SavedJobApplication = {
  candidateId: string;
  requisitionId: string;
  email: string;
};

function storageKey(requisitionId: string) {
  return `opensky_job_application_${requisitionId}`;
}

export function loadSavedJobApplication(requisitionId: string): SavedJobApplication | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(requisitionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedJobApplication;
    if (!parsed?.candidateId || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveJobApplication(entry: SavedJobApplication) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(entry.requisitionId), JSON.stringify(entry));
}
