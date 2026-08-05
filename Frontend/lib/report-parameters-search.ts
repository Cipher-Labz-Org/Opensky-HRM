export type ReportParamFilterKey = "departmentId" | "locationId" | "status" | "gradeId";

export type ReportGroupByKey =
  | "department"
  | "jobTitle"
  | "location"
  | "grade"
  | "businessUnit"
  | "status";

export interface ReportFilterPill {
  key: ReportParamFilterKey;
  label: string;
}

export interface ReportFilterSection {
  key: ReportParamFilterKey;
  label: string;
  options: { value: string; label: string }[];
}

/** Meaningful group-by fields only — unique-per-row fields (e.g. Full Name) break the table. */
export const EMPLOYEE_MASTER_GROUP_BY_OPTIONS: { key: ReportGroupByKey; label: string; column: string }[] = [
  { key: "department", label: "Department", column: "Department" },
  { key: "jobTitle", label: "Job Title", column: "Job Title" },
  { key: "location", label: "Location", column: "Location" },
  { key: "grade", label: "Grade", column: "Grade" },
  { key: "businessUnit", label: "Business Unit", column: "Business Unit" },
  { key: "status", label: "Status", column: "Status" },
];

export function isValidReportGroupByKey(key: string | null | undefined): key is ReportGroupByKey {
  return Boolean(key && EMPLOYEE_MASTER_GROUP_BY_OPTIONS.some((o) => o.key === key));
}

export function reportGroupByLabel(key: ReportGroupByKey): string {
  return EMPLOYEE_MASTER_GROUP_BY_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function reportGroupByColumn(key: ReportGroupByKey): string {
  return EMPLOYEE_MASTER_GROUP_BY_OPTIONS.find((o) => o.key === key)?.column ?? key;
}

export function groupReportRowsByColumn(
  rows: Record<string, unknown>[],
  column: string,
  getCell: (row: Record<string, unknown>, col: string) => unknown,
): { key: string; items: Record<string, unknown>[] }[] {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const raw = getCell(row, column);
    const key = raw == null || String(raw).trim() === "" ? "—" : String(raw);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  const groups = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([key, items]) => ({ key, items }));

  // If nearly every row is its own group, grouping is useless — fall back to flat list.
  if (groups.length > 1 && groups.every((g) => g.items.length <= 1) && groups.length >= rows.length * 0.9) {
    return [];
  }
  return groups;
}
