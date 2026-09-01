"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { DatePickerField } from "@/components/ui";
import { FormSelect } from "@/components/ui/FormSelect";
import { applyFromDateInRange, applyToDateInRange } from "@/lib/datePickerIso";
import { formatDateTime } from "@/lib/date-utils";
import { formatInt } from "@/lib/workspace-charts";
import { getReportIconPaths } from "@/lib/report-icons";
import { useApplyFilter } from "@/lib/use-apply-filter";
import { getApiBaseUrl } from "@/config/constants";
import { useAuth } from "@/contexts/auth-context";
import { filterLookupsByAllowedIds } from "@/lib/people-scope-filters";
import { sanitizeSearchInput } from "@/lib/input-validation";
import { ReportParametersSearchBar } from "@/components/reports/ReportParametersSearchBar";
import {
  EMPLOYEE_MASTER_GROUP_BY_OPTIONS,
  groupReportRowsByColumn,
  isValidReportGroupByKey,
  reportGroupByColumn,
  type ReportFilterPill,
  type ReportFilterSection,
  type ReportGroupByKey,
  type ReportParamFilterKey,
} from "@/lib/report-parameters-search";

interface ReportItem {
  key: string;
  name: string;
  description: string;
  supportsDepartmentFilter?: boolean;
  periodFilterMode?: string;
}
interface ReportCategory { key: string; name: string; icon: string; reports: ReportItem[]; }
interface DepartmentOption { id: string; name: string; }
interface LocationOption { id: string; name: string; }
interface GradeOption { id: string; name: string; }
interface EmployeeStatusOption { id: string; name: string; code: string; }
interface ReportResult { reportName: string; generatedAt: string; columns: string[]; rows: Record<string, unknown>[]; totalRows: number; }

/**
 * Read a report cell when row keys may be camelCased by the API (DictionaryKeyPolicy).
 * Matches exact column header, camelCase variant, or case-insensitive key.
 */
function getReportCell(row: Record<string, unknown>, column: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, column)) return row[column];
  const camelKey = column.length > 0 ? column.charAt(0).toLowerCase() + column.slice(1) : column;
  if (Object.prototype.hasOwnProperty.call(row, camelKey)) return row[camelKey];
  const lower = column.toLowerCase();
  const found = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return found !== undefined ? row[found] : undefined;
}

/** Query keys mirrored in the address bar for shareable report links. */
const REPORT_URL_FILTER_KEYS = ["departmentId", "locationId", "employeeName", "status", "gradeId", "from", "to", "year", "month", "date"] as const;

const EMPLOYEE_MASTER_REPORT_KEY = "employee-master";

function readUrlReportFilterOverrides(sp: { get: (key: string) => string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of REPORT_URL_FILTER_KEYS) {
    const v = sp.get(k);
    if (v != null && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

function getDefaultQueryParamsForItem(item: ReportItem | null | undefined): Record<string, string> {
  const p: Record<string, string> = {};
  if (!item) return p;
  const today = new Date();
  const mode = item.periodFilterMode || "none";
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  if (mode === "dateRange") {
    if (item.key === "daily-attendance" || item.key === "overtime-report" || item.key === "overtime-detail") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      p.from = isoDate(from);
      p.to = isoDate(today);
    } else if (item.key === "absence-frequency") {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      p.from = isoDate(from);
      p.to = isoDate(today);
    } else if (item.key === "absent-report") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      p.from = isoDate(from);
      p.to = isoDate(today);
    } else {
      const from = new Date(today);
      from.setFullYear(from.getFullYear() - 1);
      p.from = isoDate(from);
      p.to = isoDate(today);
    }
  } else if (mode === "yearMonth") {
    p.year = String(today.getFullYear());
    p.month = String(today.getMonth() + 1);
  } else if (mode === "singleDate") {
    p.date = isoDate(today);
  } else if (mode === "monthOnly") {
    p.month = String(today.getMonth() + 1);
  }
  return p;
}

function mergeUrlFiltersIntoReportParams(
  item: ReportItem | null | undefined,
  base: Record<string, string>,
  url: Record<string, string>
): Record<string, string> {
  const merged = { ...base };
  if (!item) return merged;
  if (item.supportsDepartmentFilter && url.departmentId) merged.departmentId = url.departmentId;
  if (item.supportsDepartmentFilter && url.locationId) merged.locationId = url.locationId;
  if (item.supportsDepartmentFilter && url.employeeName) merged.employeeName = url.employeeName;
  if (item.key === EMPLOYEE_MASTER_REPORT_KEY && url.status) merged.status = url.status;
  if (item.key === EMPLOYEE_MASTER_REPORT_KEY && url.gradeId) merged.gradeId = url.gradeId;
  const mode = item.periodFilterMode || "none";
  if (mode === "dateRange") {
    if (url.from) merged.from = url.from;
    if (url.to) merged.to = url.to;
    // Legacy single-date links (?date=…) for Attendance Register
    if (item.key === "daily-attendance" && url.date && !url.from && !url.to) {
      merged.from = url.date;
      merged.to = url.date;
    }
  } else if (mode === "yearMonth") {
    if (url.year) merged.year = url.year;
    if (url.month) merged.month = url.month;
  } else if (mode === "singleDate") {
    if (url.date) merged.date = url.date;
  } else if (mode === "monthOnly") {
    if (url.month) merged.month = url.month;
  }
  return merged;
}

function resolveReportQueryParams(
  item: ReportItem | null | undefined,
  urlOverrides?: Record<string, string> | null
): Record<string, string> {
  const defaults = getDefaultQueryParamsForItem(item);
  if (!urlOverrides || Object.keys(urlOverrides).length === 0) return defaults;
  return mergeUrlFiltersIntoReportParams(item, defaults, urlOverrides);
}

function filterParamsForUrlSig(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of REPORT_URL_FILTER_KEYS) {
    if (params[k]) out[k] = params[k];
  }
  return out;
}

function canonicalFilterSig(filters: Record<string, string>): string {
  return Object.keys(filters)
    .sort()
    .map((k) => `${k}=${filters[k]}`)
    .join("&");
}

function buildReportUrlQuery(
  catKey: string,
  rptKey: string,
  item: ReportItem | null | undefined,
  mergedParams: Record<string, string>
): string {
  const qs = new URLSearchParams();
  qs.set("category", catKey);
  qs.set("report", rptKey);
  if (!item) return qs.toString();
  if (item.supportsDepartmentFilter && mergedParams.departmentId) qs.set("departmentId", mergedParams.departmentId);
  if (item.supportsDepartmentFilter && mergedParams.locationId) qs.set("locationId", mergedParams.locationId);
  if (item.supportsDepartmentFilter && mergedParams.employeeName) qs.set("employeeName", mergedParams.employeeName);
  if (item.key === EMPLOYEE_MASTER_REPORT_KEY && mergedParams.status) qs.set("status", mergedParams.status);
  if (item.key === EMPLOYEE_MASTER_REPORT_KEY && mergedParams.gradeId) qs.set("gradeId", mergedParams.gradeId);
  const mode = item.periodFilterMode || "none";
  if (mode === "dateRange") {
    if (mergedParams.from) qs.set("from", mergedParams.from);
    if (mergedParams.to) qs.set("to", mergedParams.to);
  } else if (mode === "yearMonth") {
    if (mergedParams.year) qs.set("year", mergedParams.year);
    if (mergedParams.month) qs.set("month", mergedParams.month);
  } else if (mode === "singleDate") {
    if (mergedParams.date) qs.set("date", mergedParams.date);
  } else if (mode === "monthOnly") {
    if (mergedParams.month) qs.set("month", mergedParams.month);
  }
  return qs.toString();
}

const ICONS: Record<string, string> = {
  users: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  calendar: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  clock: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  banknotes: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  briefcase: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z",
  "chart-bar": "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  building: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
};

const CATEGORY_COLORS: Record<string, string> = {
  people: "bg-blue-500", leave: "bg-emerald-500", attendance: "bg-amber-500", payroll: "bg-violet-500",
  recruitment: "bg-pink-500", performance: "bg-orange-500", organization: "bg-cyan-500", compliance: "bg-red-500",
};

async function exportReportToExcel(
  category: string,
  reportKey: string,
  params: Record<string, string>,
  fallbackFilename: string,
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const qs = new URLSearchParams(params).toString();
  const path = `/api/reports/${category}/${reportKey}/xlsx${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error("Cannot reach the API. Ensure the backend is running.");
  }

  if (!res.ok) {
    throw new Error((await res.text().catch(() => "")) || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printReport(result: ReportResult, sortedRows: Record<string, unknown>[]) {
  const printWin = window.open("", "_blank", "width=1100,height=800");
  if (!printWin) return;

  const headerHtml = result.columns.map(c => `<th style="border:1px solid #ccc;padding:4px 8px;background:#f1f5f9;font-size:10px;text-transform:uppercase;text-align:left;white-space:nowrap">${c}</th>`).join("");
  const rowsHtml = sortedRows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">` +
    `<td style="border:1px solid #e2e8f0;padding:3px 6px;font-size:11px;color:#94a3b8;text-align:center">${i + 1}</td>` +
    result.columns.map(c => {
      const v = getReportCell(row, c);
      return `<td style="border:1px solid #e2e8f0;padding:3px 8px;font-size:11px;white-space:nowrap">${v ?? ""}</td>`;
    }).join("") + "</tr>"
  ).join("");

  printWin.document.write(`<!DOCTYPE html><html><head><title>${result.reportName}</title></head><body style="font-family:Arial,sans-serif;margin:20px">
    <h2 style="margin:0 0 4px;font-size:16px">${result.reportName}</h2>
    <p style="margin:0 0 12px;font-size:11px;color:#64748b">Generated: ${formatDateTime(result.generatedAt)} &bull; ${sortedRows.length} records</p>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="border:1px solid #ccc;padding:4px 6px;background:#f1f5f9;font-size:10px;width:30px">#</th>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin-top:16px;font-size:9px;color:#94a3b8;text-align:right">OpenSky HRM &bull; Printed ${new Date().toLocaleString()}</p>
  </body></html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<ReportCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const resultsSearch = useApplyFilter();
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  /** Dedupes URL-driven loads (incl. filters) vs. identical `searchParams` after `router.replace`. */
  const lastHandledReportUrlSig = useRef<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusOption[]>([]);
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [filterEmployeeName, setFilterEmployeeName] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGradeId, setFilterGradeId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [reportGroupBy, setReportGroupBy] = useState<ReportGroupByKey | null>(null);
  const [collapsedReportGroups, setCollapsedReportGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<ReportCategory[]>("/api/reports/catalog").then((cats) => {
      setCatalog(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].key);
    }).catch(() => {});
  }, []);

  // Drop invalid / legacy group-by keys (e.g. old "fullName") that break the table.
  useEffect(() => {
    if (reportGroupBy && !isValidReportGroupByKey(reportGroupBy)) {
      setReportGroupBy(null);
      setCollapsedReportGroups(new Set());
    }
  }, [reportGroupBy]);

  useEffect(() => {
    apiFetch<DepartmentOption[]>("/api/organization/departments")
      .then((rows) => setDepartments(Array.isArray(rows) ? rows.map((d) => ({ id: d.id, name: d.name })) : []))
      .catch(() => setDepartments([]));
    apiFetch<LocationOption[]>("/api/organization/locations")
      .then((rows) => setLocations(Array.isArray(rows) ? rows.map((l) => ({ id: l.id, name: l.name })) : []))
      .catch(() => setLocations([]));
    apiFetch<GradeOption[]>("/api/organization/grades")
      .then((rows) => setGrades(Array.isArray(rows) ? rows.map((g) => ({ id: g.id, name: g.name })) : []))
      .catch(() => setGrades([]));
    apiFetch<EmployeeStatusOption[]>("/api/organization/employee-statuses")
      .then((rows) => setEmployeeStatuses(Array.isArray(rows) ? rows : []))
      .catch(() => setEmployeeStatuses([]));
  }, []);

  const visibleLocations = useMemo(
    () => filterLookupsByAllowedIds(locations, user?.assignedLocationIds),
    [locations, user?.assignedLocationIds],
  );

  const visibleGrades = useMemo(
    () => filterLookupsByAllowedIds(grades, user?.assignedGradeIds),
    [grades, user?.assignedGradeIds],
  );

  function syncFilterInputsFromParams(params: Record<string, string>) {
    setFilterDepartmentId(params.departmentId ?? "");
    setFilterLocationId(params.locationId ?? "");
    setFilterEmployeeName(params.employeeName ?? "");
    setFilterStatus(params.status ?? "");
    setFilterGradeId(params.gradeId ?? "");
    setFilterFrom(params.from ?? "");
    setFilterTo(params.to ?? "");
    setFilterYear(params.year ?? "");
    setFilterMonth(params.month ?? "");
    setFilterDate(params.date ?? "");
  }

  function onReportFromChange(v: string) {
    const { from, to } = applyFromDateInRange(v, filterTo);
    setFilterFrom(from);
    setFilterTo(to);
  }

  function onReportToChange(v: string) {
    const { from, to } = applyToDateInRange(filterFrom, v);
    setFilterFrom(from);
    setFilterTo(to);
  }

  function collectParamsFromForm(
    item: ReportItem | null | undefined,
    overrides?: Partial<{
      departmentId: string;
      locationId: string;
      employeeName: string;
      status: string;
      gradeId: string;
    }>,
  ): Record<string, string> {
    const p: Record<string, string> = {};
    if (!item) return p;
    const departmentId = overrides?.departmentId ?? filterDepartmentId;
    const locationId = overrides?.locationId ?? filterLocationId;
    const employeeName = overrides?.employeeName ?? filterEmployeeName;
    const status = overrides?.status ?? filterStatus;
    const gradeId = overrides?.gradeId ?? filterGradeId;
    if (item.supportsDepartmentFilter && departmentId.trim())
      p.departmentId = departmentId.trim();
    if (item.supportsDepartmentFilter && locationId.trim())
      p.locationId = locationId.trim();
    if (item.supportsDepartmentFilter && employeeName.trim())
      p.employeeName = employeeName.trim();
    if (item.key === EMPLOYEE_MASTER_REPORT_KEY && status.trim())
      p.status = status.trim();
    if (item.key === EMPLOYEE_MASTER_REPORT_KEY && gradeId.trim())
      p.gradeId = gradeId.trim();
    const mode = item.periodFilterMode || "none";
    if (mode === "dateRange") {
      if (filterFrom) p.from = filterFrom;
      if (filterTo) p.to = filterTo;
    } else if (mode === "yearMonth") {
      if (filterYear) p.year = filterYear;
      if (filterMonth) p.month = filterMonth;
    } else if (mode === "singleDate") {
      if (filterDate) p.date = filterDate;
    } else if (mode === "monthOnly") {
      if (filterMonth) p.month = filterMonth;
    }
    return p;
  }

  const loadReport = useCallback(async (catKey: string, rptKey: string, queryParams: Record<string, string>) => {
    const qs = new URLSearchParams(queryParams).toString();
    const path = `/api/reports/${catKey}/${rptKey}${qs ? `?${qs}` : ""}`;
    const data = await apiFetch<ReportResult>(path);
    setResult(data);
  }, []);

  const runReport = useCallback(
    async (catKey: string, rptKey: string, urlOverrides?: Record<string, string> | null) => {
      const cat = catalog.find((c) => c.key === catKey);
      const item = cat?.reports.find((r) => r.key === rptKey);
      setSelectedCategory(catKey);
      setSelectedReport(rptKey);
      setResult(null);
      setReportError("");
      setLoading(true);
      setSortCol(null);
      setReportGroupBy(null);
      setCollapsedReportGroups(new Set());
      resultsSearch.clear();
      const merged = resolveReportQueryParams(item, urlOverrides);
      syncFilterInputsFromParams(merged);
      try {
        await loadReport(catKey, rptKey, merged);
        const qs = buildReportUrlQuery(catKey, rptKey, item, merged);
        const sig = `${catKey}:${rptKey}:${canonicalFilterSig(filterParamsForUrlSig(merged))}`;
        lastHandledReportUrlSig.current = sig;
        router.replace(`${pathname}?${qs}`, { scroll: false });
      } catch (err) {
        setReportError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    },
    [catalog, loadReport, pathname, router]
  );

  const activeReportDef = useMemo(() => {
    const c = catalog.find((x) => x.key === selectedCategory);
    return c?.reports.find((r) => r.key === selectedReport) ?? null;
  }, [catalog, selectedCategory, selectedReport]);

  const isEmployeeMasterReport = activeReportDef?.key === EMPLOYEE_MASTER_REPORT_KEY;

  const reportFilterSections = useMemo<ReportFilterSection[]>(() => {
    if (!activeReportDef?.supportsDepartmentFilter) return [];
    const sections: ReportFilterSection[] = [
      {
        key: "departmentId",
        label: "Department",
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
      {
        key: "locationId",
        label: "Location",
        options: visibleLocations.map((l) => ({ value: l.id, label: l.name })),
      },
    ];
    if (isEmployeeMasterReport) {
      sections.push(
        {
          key: "status",
          label: "Status",
          options: employeeStatuses.map((s) => ({ value: s.name, label: s.name })),
        },
        {
          key: "gradeId",
          label: "Grade",
          options: visibleGrades.map((g) => ({ value: g.id, label: g.name })),
        },
      );
    }
    return sections;
  }, [activeReportDef, departments, visibleLocations, employeeStatuses, visibleGrades, isEmployeeMasterReport]);

  const reportFilterPills = useMemo<ReportFilterPill[]>(() => {
    const pills: ReportFilterPill[] = [];
    if (filterDepartmentId) {
      pills.push({
        key: "departmentId",
        label: departments.find((d) => d.id === filterDepartmentId)?.name ?? "Department",
      });
    }
    if (filterLocationId) {
      pills.push({
        key: "locationId",
        label: locations.find((l) => l.id === filterLocationId)?.name ?? "Location",
      });
    }
    if (filterStatus) pills.push({ key: "status", label: filterStatus });
    if (filterGradeId) {
      pills.push({
        key: "gradeId",
        label: grades.find((g) => g.id === filterGradeId)?.name ?? "Grade",
      });
    }
    return pills;
  }, [filterDepartmentId, filterLocationId, filterStatus, filterGradeId, departments, locations, grades]);

  function getReportFilterValue(key: ReportParamFilterKey): string {
    switch (key) {
      case "departmentId": return filterDepartmentId;
      case "locationId": return filterLocationId;
      case "status": return filterStatus;
      case "gradeId": return filterGradeId;
      default: return "";
    }
  }

  function handleReportFilterChange(key: ReportParamFilterKey, value: string) {
    const next = getReportFilterValue(key) === value ? "" : value;
    void applyReportFilters({ [key]: next });
  }

  function handleRemoveReportFilter(key: ReportParamFilterKey) {
    void applyReportFilters({ [key]: "" });
  }

  function handleClearReportFilters() {
    setReportGroupBy(null);
    setCollapsedReportGroups(new Set());
    void applyReportFilters({
      departmentId: "",
      locationId: "",
      employeeName: "",
      status: "",
      gradeId: "",
    });
  }

  function toggleReportGroupCollapsed(key: string) {
    setCollapsedReportGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applyReportFilters(
    overrides?: Partial<{
      departmentId: string;
      locationId: string;
      employeeName: string;
      status: string;
      gradeId: string;
    }>,
  ) {
    if (!selectedCategory || !selectedReport) return;
    if (overrides?.departmentId !== undefined) setFilterDepartmentId(overrides.departmentId);
    if (overrides?.locationId !== undefined) setFilterLocationId(overrides.locationId);
    if (overrides?.employeeName !== undefined) setFilterEmployeeName(overrides.employeeName);
    if (overrides?.status !== undefined) setFilterStatus(overrides.status);
    if (overrides?.gradeId !== undefined) setFilterGradeId(overrides.gradeId);
    setLoading(true);
    setReportError("");
    setSortCol(null);
    resultsSearch.clear();
    try {
      const params = collectParamsFromForm(activeReportDef, overrides);
      await loadReport(selectedCategory, selectedReport, params);
      const qs = buildReportUrlQuery(selectedCategory, selectedReport, activeReportDef, params);
      const sig = `${selectedCategory}:${selectedReport}:${canonicalFilterSig(filterParamsForUrlSig(params))}`;
      lastHandledReportUrlSig.current = sig;
      router.replace(`${pathname}?${qs}`, { scroll: false });
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cat = searchParams.get("category");
    const rpt = searchParams.get("report");
    if (!cat || !rpt || catalog.length === 0) return;
    const catObj = catalog.find((c) => c.key === cat);
    const item = catObj?.reports.find((x) => x.key === rpt);
    if (!item) return;
    const overrides = readUrlReportFilterOverrides(searchParams);
    const merged = resolveReportQueryParams(item, overrides);
    const sig = `${cat}:${rpt}:${canonicalFilterSig(filterParamsForUrlSig(merged))}`;
    if (lastHandledReportUrlSig.current === sig) return;
    lastHandledReportUrlSig.current = sig;
    void runReport(cat, rpt, Object.keys(overrides).length > 0 ? overrides : undefined);
  }, [searchParams, catalog, runReport]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const closeReport = () => {
    setResult(null);
    setSelectedReport("");
    setLoading(false);
    setReportError("");
    setReportGroupBy(null);
    setCollapsedReportGroups(new Set());
    resultsSearch.clear();
    lastHandledReportUrlSig.current = null;
    router.replace(pathname, { scroll: false });
  };

  const isReportOpen = Boolean(result || loading || selectedReport);

  const activeCat = catalog.find(c => c.key === selectedCategory);

  const filteredRows = result?.rows?.filter(row => {
    if (!resultsSearch.applied) return true;
    const term = resultsSearch.applied.toLowerCase();
    return result.columns.some(col =>
      String(getReportCell(row, col) ?? "").toLowerCase().includes(term)
    );
  }) ?? [];

  const sortedRows = sortCol
    ? [...filteredRows].sort((a, b) => {
        const va = getReportCell(a, sortCol) ?? "";
        const vb = getReportCell(b, sortCol) ?? "";
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      })
    : filteredRows;

  const reportRowGroups = useMemo(() => {
    if (!isEmployeeMasterReport || !isValidReportGroupByKey(reportGroupBy) || !result) return null;
    const column = reportGroupByColumn(reportGroupBy);
    const groups = groupReportRowsByColumn(sortedRows, column, getReportCell);
    return groups.length > 0 ? groups : null;
  }, [isEmployeeMasterReport, reportGroupBy, sortedRows, result]);

  const reportGroupByOptions = isEmployeeMasterReport
    ? EMPLOYEE_MASTER_GROUP_BY_OPTIONS.map((o) => ({ key: o.key, label: o.label }))
    : [];

  const tableBodyEntries = useMemo(() => {
    type DataEntry = { kind: "data"; row: Record<string, unknown>; index: number };
    type GroupEntry = { kind: "group"; key: string; count: number };
    if (!reportRowGroups) {
      return sortedRows.map((row, index): DataEntry => ({ kind: "data", row, index }));
    }
    const entries: Array<DataEntry | GroupEntry> = [];
    let index = 0;
    for (const group of reportRowGroups) {
      entries.push({ kind: "group", key: group.key, count: group.items.length });
      if (!collapsedReportGroups.has(group.key)) {
        for (const row of group.items) {
          entries.push({ kind: "data", row, index: index++ });
        }
      }
    }
    return entries;
  }, [reportRowGroups, sortedRows, collapsedReportGroups]);

  const showLeaveInsightsTemplate =
    selectedCategory === "leave" &&
    (selectedReport === "absence-frequency" || selectedReport === "leave-by-type") &&
    !!result;

  const leaveTemplateMetrics = useMemo(() => {
    if (!result || !showLeaveInsightsTemplate) return null;
    const totalRecords = sortedRows.length;
    if (selectedReport === "absence-frequency") {
      const totalInstances = sortedRows.reduce(
        (sum, row) => sum + Number(getReportCell(row, "Leave Instances") ?? 0),
        0,
      );
      const totalDays = sortedRows.reduce(
        (sum, row) => sum + Number(getReportCell(row, "Total Days") ?? 0),
        0,
      );
      const topEmployee = String(getReportCell(sortedRows[0] ?? {}, "Employee Name") ?? "N/A");
      return {
        cards: [
          { label: "Employees listed", value: formatInt(totalRecords) },
          { label: "Leave instances", value: formatInt(totalInstances) },
          { label: "Total leave days", value: formatInt(totalDays) },
          { label: "Top frequency employee", value: String(topEmployee) },
        ],
      };
    }

    const totalRequests = sortedRows.reduce(
      (sum, row) => sum + Number(getReportCell(row, "Total Requests") ?? 0),
      0,
    );
    const totalDays = sortedRows.reduce(
      (sum, row) => sum + Number(getReportCell(row, "Total Days") ?? 0),
      0,
    );
    const topType = String(getReportCell(sortedRows[0] ?? {}, "Leave Type") ?? "N/A");
    return {
      cards: [
        { label: "Leave types listed", value: formatInt(totalRecords) },
        { label: "Total requests", value: formatInt(totalRequests) },
        { label: "Total leave days", value: formatInt(totalDays) },
        { label: "Most used type", value: String(topType) },
      ],
    };
  }, [result, selectedReport, showLeaveInsightsTemplate, sortedRows]);

  const totalReportDefinitions = useMemo(
    () => catalog.reduce((sum, c) => sum + c.reports.length, 0),
    [catalog]
  );

  const reportStatsKpis = useMemo(() => {
    const inSection = activeCat?.reports.length ?? 0;
    return [
      {
        label: "Report categories",
        value: formatInt(catalog.length),
        sub: "From the reports catalog API",
      },
      {
        label: "Standard reports",
        value: formatInt(totalReportDefinitions),
        sub: "Across all modules in catalog",
      },
      {
        label: "In this section",
        value: formatInt(inSection),
        sub: activeCat ? `${activeCat.name}` : "Select a category",
      },
    ];
  }, [catalog.length, totalReportDefinitions, activeCat]);

  return (
    <>
      {!isReportOpen && (
        <>
          <AppTopbar title="Reports" subtitle="Generate, view, and export standard HR reports across all modules." />

          <div className="mt-6 flex flex-col gap-6 lg:flex-row" style={{ minHeight: "calc(100vh - 160px)" }}>
            <div className="w-full shrink-0 lg:w-72">
              <div className="lg:sticky lg:top-4 space-y-2">
                {catalog.map((cat) => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.key);
                        setSelectedReport("");
                        setResult(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                        isActive
                          ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                          : "border-slate-200/80 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[cat.key] ?? "bg-slate-500"} text-white`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[cat.icon] ?? ICONS.users} />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="truncate">{cat.name}</div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {cat.reports.length} report{cat.reports.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-6">
              {catalog.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-3">
                  {reportStatsKpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
                      <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeCat && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{activeCat.name} reports</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {activeCat.reports.map((rpt) => {
                      const reportIconPaths = getReportIconPaths(activeCat.key, rpt.key);
                      return (
                        <button
                          key={rpt.key}
                          type="button"
                          onClick={() => runReport(activeCat.key, rpt.key)}
                          className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[activeCat.key] ?? "bg-slate-500"} bg-opacity-10`}
                            >
                              <svg
                                className={`h-4 w-4 ${CATEGORY_COLORS[activeCat.key]?.replace("bg-", "text-") ?? "text-slate-500"}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                              >
                                {reportIconPaths.map((d, i) => (
                                  <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
                                ))}
                              </svg>
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 transition group-hover:text-slate-900">
                                {rpt.name}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Full-page report view — hides catalog so headers never stack/crash */}
      {isReportOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[52px] z-40 flex flex-col bg-white lg:left-72">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={closeReport}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                Back
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-800">
                  {result?.reportName ?? activeReportDef?.name ?? "Report"}
                </h2>
                {result && (
                  <p className="text-[11px] text-slate-500">
                    {result.totalRows} record{result.totalRows !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
            {result && (
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative hidden sm:block">
                  <input
                    type="text"
                    placeholder="Search results… (Enter)"
                    value={resultsSearch.input}
                    onChange={(e) => resultsSearch.setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") resultsSearch.apply();
                    }}
                    className="w-48 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 md:w-56"
                  />
                  <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCategory || !selectedReport || !result) return;
                    const params = collectParamsFromForm(activeReportDef);
                    const filename = `${result.reportName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    void exportReportToExcel(selectedCategory, selectedReport, params, filename).catch(() => {});
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => printReport(result, sortedRows)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                  Print
                </button>
                <button
                  type="button"
                  onClick={closeReport}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </div>

          {activeReportDef &&
            (activeReportDef.supportsDepartmentFilter ||
              (activeReportDef.periodFilterMode && activeReportDef.periodFilterMode !== "none")) && (
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5">
              <div className="flex flex-col gap-3">
                {activeReportDef.supportsDepartmentFilter && (
                  <ReportParametersSearchBar
                      employeeSearch={filterEmployeeName}
                      onEmployeeSearchChange={(value) => setFilterEmployeeName(sanitizeSearchInput(value))}
                      onApply={() => void applyReportFilters()}
                      groupBy={reportGroupBy}
                      onGroupByChange={(key) => {
                        setReportGroupBy(key);
                        setCollapsedReportGroups(new Set());
                      }}
                      groupByOptions={reportGroupByOptions}
                      filterSections={reportFilterSections}
                      filterPills={reportFilterPills}
                      onFilterChange={handleReportFilterChange}
                      onRemoveFilter={handleRemoveReportFilter}
                      activeFilterValues={{
                        departmentId: filterDepartmentId || undefined,
                        locationId: filterLocationId || undefined,
                        status: filterStatus || undefined,
                        gradeId: filterGradeId || undefined,
                      }}
                      onClearAll={handleClearReportFilters}
                      loading={loading}
                    />
                )}
                {(activeReportDef.periodFilterMode && activeReportDef.periodFilterMode !== "none") && (
                  <div>
                    <p className="mb-2 text-[11px] font-medium text-slate-500">Date range</p>
                    <div className="flex flex-wrap items-end gap-3">
              {activeReportDef.periodFilterMode === "dateRange" && (
                <>
                  <div className="w-[9.5rem] shrink-0">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">From</label>
                    <DatePickerField value={filterFrom} onChange={onReportFromChange} max={filterTo || undefined} className="h-[42px] rounded-lg py-2 text-xs" />
                  </div>
                  <div className="w-[9.5rem] shrink-0">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">To</label>
                    <DatePickerField value={filterTo} onChange={onReportToChange} min={filterFrom || undefined} className="h-[42px] rounded-lg py-2 text-xs" />
                  </div>
                </>
              )}
              {activeReportDef.periodFilterMode === "yearMonth" && (
                <>
                  <div className="w-[6rem] shrink-0">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Year</label>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="w-[10.5rem] shrink-0">
                    <label className="mb-1 block text-[10px] font-medium text-slate-500">Month</label>
                    <FormSelect
                      value={filterMonth}
                      onValueChange={setFilterMonth}
                      options={Array.from({ length: 12 }, (_, i) => ({
                        value: String(i + 1),
                        label: new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
                      }))}
                    />
                  </div>
                </>
              )}
              {activeReportDef.periodFilterMode === "singleDate" && (
                <div className="w-[9.5rem] shrink-0">
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Date</label>
                  <DatePickerField value={filterDate} onChange={setFilterDate} className="h-[42px] rounded-lg py-2 text-xs" />
                </div>
              )}
              {activeReportDef.periodFilterMode === "monthOnly" && (
                <div className="w-[10.5rem] shrink-0">
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Month</label>
                  <FormSelect
                    value={filterMonth}
                    onValueChange={setFilterMonth}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      label: new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
                    }))}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => void applyReportFilters()}
                disabled={loading}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Apply filters
              </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading state inside overlay */}
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <span className="ml-3 text-sm text-slate-500">Generating report...</span>
            </div>
          )}

          {!loading && reportError && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <p className="max-w-md text-sm font-medium text-red-700">{reportError}</p>
              <p className="mt-2 max-w-md text-xs text-slate-500">Adjust the From / To dates and filters above, then click Apply filters.</p>
            </div>
          )}

          {/* Table body */}
          {result && !loading && !reportError && (
            <div className="flex-1 overflow-auto px-6 py-4">
              {showLeaveInsightsTemplate && leaveTemplateMetrics && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {selectedReport === "absence-frequency" ? "Absence Frequency Template" : "Leave by Type Template"}
                    </h3>
                    <span className="text-[11px] text-slate-500">Auto-generated from current filters</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {leaveTemplateMetrics.cards.map((card) => (
                      <div key={card.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{card.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sortedRows.length === 0 ? (
                <div className="py-20 text-center text-sm text-slate-400">No records found.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full border-collapse text-[12px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50/60">
                        <th className="py-3 px-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-10">#</th>
                        {result.columns.map(col => (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className="py-3 px-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer select-none hover:text-[#1e88ff] transition bg-transparent"
                          >
                            <span className="inline-flex items-center gap-1">
                              {col}
                              {sortCol === col && (
                                <svg className="h-3 w-3 text-[#1e88ff]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d={sortAsc ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
                                </svg>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableBodyEntries.map((entry, i) =>
                        entry.kind === "group" ? (
                          <tr key={`group-${entry.key}`} className="border-b border-slate-200 bg-slate-50/90">
                            <td colSpan={result.columns.length + 1} className="py-2 px-3">
                              <button
                                type="button"
                                onClick={() => toggleReportGroupCollapsed(entry.key)}
                                className="flex w-full items-center gap-2 text-left text-[12px] font-semibold text-slate-700"
                              >
                                <svg className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${collapsedReportGroups.has(entry.key) ? "-rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                  <path d="M10 14l-5-5h10l-5 5z" />
                                </svg>
                                <span>{entry.key}</span>
                                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">{entry.count}</span>
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={`row-${entry.index}-${i}`} className={`border-b border-slate-100 transition hover:bg-[#eef6ff] ${entry.index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                            <td className="py-2 px-3 text-[10px] font-medium text-slate-400">{entry.index + 1}</td>
                            {result.columns.map((col) => (
                              <td key={col} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                {formatCell(col, getReportCell(entry.row, col))}
                              </td>
                            ))}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {result && !loading && !reportError && (
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-2 text-right text-[10px] text-slate-400">
              Generated at {formatDateTime(result.generatedAt)} &middot; Showing {sortedRows.length} of {result.totalRows} records
            </div>
          )}
        </div>
      )}
    </>
  );
}

function formatCell(col: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-300">&mdash;</span>;
  const s = String(value);

  if (col === "Status" || col === "Employment Status" || col === "Eligible Status") {
    const color = s === "Terminated" || s === "EXPIRED" || s === "Rejected" || s === "Cancelled"
      ? "bg-red-50 text-red-600"
      : s === "Approved" || s === "Present" || s === "Yes"
      ? "bg-emerald-50 text-emerald-600"
      : s === "Pending" || s === "PendingLevel2"
      ? "bg-amber-50 text-amber-600"
      : "bg-slate-50 text-slate-600";
    return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${color}`}>{s}</span>;
  }

  if (col === "Completed" || col === "Vacant") {
    return s === "Yes"
      ? <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Yes</span>
      : <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">No</span>;
  }

  if (col.includes("%") || col === "Progress %") {
    const n = Number(value);
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-slate-100">
          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(n, 100)}%` }} />
        </div>
        <span className="text-[10px] text-slate-500">{n}%</span>
      </div>
    );
  }

  if ((col === "Gross" || col === "Deductions" || col === "Net Pay" || col === "Amount" || col === "Total Monthly Cost" || col === "Previous" || col === "Revised") && typeof value === "number") {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return s;
}
