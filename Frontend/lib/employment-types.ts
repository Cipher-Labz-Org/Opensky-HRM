/** Fallback labels when API returns no rows (empty DB) or for legacy codes. */
export const LEGACY_EMP_TYPE_LABELS: Record<string, string> = {
  Freelance: "Freelance",
  FullTimeContract: "Full-Time Contract",
  FullTimeInternship: "Full-Time Internship",
  FullTimePermanent: "Full-Time Permanent",
  FullTimeProbation: "Full-Time Probation",
  PartTimeContract: "Part-Time Contract",
  PartTimeInternship: "Part-Time Internship",
  PartTimePermanent: "Part-Time Permanent",
};

export const LEGACY_EMP_TYPE_OPTIONS: readonly string[] = [
  "Freelance",
  "FullTimeContract",
  "FullTimeInternship",
  "FullTimePermanent",
  "FullTimeProbation",
  "PartTimeContract",
  "PartTimeInternship",
  "PartTimePermanent",
];

export interface EmploymentTypeCatalogItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface EmploymentTypeOption {
  value: string;
  label: string;
}

/** Active types from Settings, sorted; if none active but rows exist, uses all rows; else legacy enum. */
export function employmentTypeOptionsFromCatalog(types: EmploymentTypeCatalogItem[]): EmploymentTypeOption[] {
  const active = types.filter((t) => t.isActive);
  const source = active.length > 0 ? active : types.length > 0 ? types : null;
  if (source) {
    return [...source]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((t) => ({ value: t.code, label: t.name }));
  }
  return LEGACY_EMP_TYPE_OPTIONS.map((code) => ({ value: code, label: LEGACY_EMP_TYPE_LABELS[code] }));
}

/** All catalog rows for People list filters (includes inactive so filters match stored employee codes). */
export function employmentTypeFilterOptions(types: EmploymentTypeCatalogItem[]): EmploymentTypeOption[] {
  if (types.length === 0) {
    return LEGACY_EMP_TYPE_OPTIONS.map((code) => ({ value: code, label: LEGACY_EMP_TYPE_LABELS[code] }));
  }
  return [...types]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((t) => ({ value: t.code, label: t.isActive ? t.name : `${t.name} (inactive)` }));
}

export function employmentTypeDisplayName(types: EmploymentTypeCatalogItem[], code: string | null | undefined): string {
  if (!code) return "—";
  const row = types.find((t) => t.code === code);
  if (row) return row.name;
  return LEGACY_EMP_TYPE_LABELS[code] ?? code;
}

export function isKnownEmploymentTypeCode(types: EmploymentTypeCatalogItem[], code: string): boolean {
  if (types.some((t) => t.code === code)) return true;
  return LEGACY_EMP_TYPE_LABELS[code] !== undefined;
}

/** First active type code for defaults (e.g. reactivate); falls back to legacy. */
export function defaultEmploymentTypeCode(types: EmploymentTypeCatalogItem[]): string {
  const opts = employmentTypeOptionsFromCatalog(types);
  return opts[0]?.value ?? "FullTimePermanent";
}

/**
 * Dropdown options for Job / Requisition forms. If `currentCode` is set but not in the
 * active catalog (inactive type or old free-text value), prepends a synthetic option so the select stays valid.
 */
export function employmentTypeSelectOptions(
  types: EmploymentTypeCatalogItem[],
  currentCode?: string | null
): EmploymentTypeOption[] {
  const base = employmentTypeOptionsFromCatalog(types);
  const code = currentCode?.trim();
  if (!code || base.some((o) => o.value === code)) return base;
  const fromCatalog = types.find((t) => t.code === code);
  const label = fromCatalog ? `${fromCatalog.name} (inactive)` : `${employmentTypeDisplayName(types, code)} (legacy)`;
  return [{ value: code, label }, ...base];
}
