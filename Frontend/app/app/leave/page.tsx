"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId, Fragment, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, TablePagination, FlashMessageBanner, FormErrorAlert, InlinePageAlert, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import {
  DonutMixChart,
  formatInt,
  HorizontalCompareBars,
  WeeklyActivityBars,
} from "@/lib/workspace-charts";
import { useAuth } from "@/contexts/auth-context";
import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { LeaveRequestsPanel } from "@/components/workforce/LeaveRequestsPanel";
import { ROUTES } from "@/config/routes";
import { sanitizeSearchInput } from "@/lib/input-validation";

// ──────────────────────────── Types ────────────────────────────

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeCode: string;
  employeeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  coveragePerson: string | null;
  approverRemarks: string | null;
  createdAt: string;
  currentApprovalLevel: number;
  level1ApproverId: string | null;
  level1ApproverName: string | null;
  level1Remarks: string | null;
  level1ApprovedAt: string | null;
  level2ApproverId: string | null;
  level2ApproverName: string | null;
  level2Remarks: string | null;
  level2ApprovedAt: string | null;
  approverName: string | null;
  responsibleUserName: string | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface Dashboard {
  totalRequests: number;
  pendingApprovals: number;
  approvedThisMonth: number;
  upcomingHolidays: number;
  activeLeaveTypes: number;
  recentRequests: LeaveRequest[];
}

interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  defaultDaysPerYear: number;
  isPaid: boolean;
  isActive: boolean;
}

interface PolicyItem {
  id: string;
  name: string;
  description: string | null;
  maxDaysPerYear: number;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  allowEncashment: boolean;
  requiresApproval: boolean;
  leaveTypeId: string;
  leaveTypeName: string;
}

interface BalanceItem {
  id: string;
  /** Present when API returns it; used to match catalog rows. */
  leaveTypeId?: string;
  leaveTypeName: string;
  year: number;
  periodLabel?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  entitled: number;
  used: number;
  carriedForward: number;
  /** Opening carry from prior period (stays for display when current pool has expired). */
  broughtForwardDays?: number;
  remaining: number;
}

interface BalanceSummary {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  balances: BalanceItem[];
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  kind?: string;
  isRestricted: boolean;
  description: string | null;
  year: number;
  countryCode?: string;
}

interface HolidayLocaleSettings {
  countryCode: string;
  timeZoneId: string;
  countries: { code: string; label: string }[];
  timeZones: { id: string; label: string; countryCode: string }[];
}

const HOLIDAY_KINDS = ["Public", "Mercantile", "Poya", "Restricted"] as const;
type HolidayKind = (typeof HOLIDAY_KINDS)[number];
const ALL_HOLIDAY_KINDS: HolidayKind[] = [...HOLIDAY_KINDS];

function fmtHolidayWeekday(d: string, timeZone: string) {
  const iso = d.split("T")[0];
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString(undefined, { weekday: "long", timeZone });
}

function fmtHolidayDateInZone(d: string, timeZone: string) {
  const iso = d.split("T")[0];
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  });
}

function defaultTimeZoneForCountry(countryCode: string, timeZones: HolidayLocaleSettings["timeZones"]) {
  const match = timeZones.find((t) => t.countryCode === countryCode);
  return match?.id ?? "Asia/Colombo";
}

function holidayKindLabel(kind: HolidayKind): string {
  switch (kind) {
    case "Mercantile":
      return "Mercantile holiday";
    case "Poya":
      return "Poya day";
    case "Restricted":
      return "Restricted";
    default:
      return "Public holiday";
  }
}

const HOLIDAY_KIND_OPTIONS: FormSelectOption[] = HOLIDAY_KINDS.map((k) => ({ value: k, label: holidayKindLabel(k) }));

function normalizeHolidayKind(item: Pick<HolidayItem, "kind" | "isRestricted">): HolidayKind {
  const raw = item.kind?.trim();
  if (raw === "Mercantile" || raw === "Poya" || raw === "Restricted" || raw === "Public") return raw;
  return item.isRestricted ? "Restricted" : "Public";
}

function holidayKindStyles(kind: HolidayKind) {
  switch (kind) {
    case "Mercantile":
      return {
        ring: "ring-1 ring-inset ring-amber-200/80",
        chip: "bg-amber-100 text-amber-800",
        badge: "bg-amber-100/90 text-amber-800",
        legendDot: "bg-amber-500",
        legendChip: "bg-amber-100 text-amber-800",
        listBorder: "border-amber-200/80",
        listBg: "from-amber-50/60",
        listTitle: "text-amber-800",
        listDate: "text-amber-700",
        listHover: "hover:bg-amber-100/60",
        label: "Mercantile holiday",
      };
    case "Poya":
      return {
        ring: "ring-1 ring-inset ring-violet-200/80",
        chip: "bg-violet-100 text-violet-800",
        badge: "bg-violet-100/90 text-violet-800",
        legendDot: "bg-violet-500",
        legendChip: "bg-violet-100 text-violet-800",
        listBorder: "border-violet-200/80",
        listBg: "from-violet-50/60",
        listTitle: "text-violet-800",
        listDate: "text-violet-700",
        listHover: "hover:bg-violet-100/60",
        label: "Poya day",
      };
    case "Restricted":
      return {
        ring: "ring-1 ring-inset ring-rose-200/80",
        chip: "bg-rose-100 text-rose-800",
        badge: "bg-rose-100/90 text-rose-800",
        legendDot: "bg-rose-500",
        legendChip: "bg-rose-100 text-rose-800",
        listBorder: "border-rose-200/80",
        listBg: "from-rose-50/50",
        listTitle: "text-rose-800",
        listDate: "text-rose-700",
        listHover: "hover:bg-rose-100/60",
        label: "Restricted",
      };
    default:
      return {
        ring: "ring-1 ring-inset ring-emerald-200/80",
        chip: "bg-emerald-100 text-emerald-800",
        badge: "bg-emerald-100/90 text-emerald-800",
        legendDot: "bg-emerald-500",
        legendChip: "bg-emerald-100 text-emerald-800",
        listBorder: "border-emerald-200/80",
        listBg: "from-emerald-50/60",
        listTitle: "text-emerald-800",
        listDate: "text-emerald-700",
        listHover: "hover:bg-emerald-100/60",
        label: "Public holiday",
      };
  }
}

interface CalendarDay {
  date: string;
  entries: { employeeName: string; leaveTypeName: string; status: string }[];
}

interface EntitlementRule {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  ruleType: string;
  ruleConfig: string;
  isActive: boolean;
}

/** Parsed entitlement rule JSON for display only. */
interface EntitlementRuleConfigDisplay {
  year1MonthlyRate?: number;
  year1Days?: number;
  monthlyAccrualEveryYear?: boolean;
  year2ProRata?: { joinMonthStart: number; joinMonthEnd: number; days: number }[];
  year3PlusDays?: number;
  applicableGender?: string;
  brackets?: { childFrom: number; childTo: number | null; days: number }[];
  defaultDays?: number;
  narrative?: { intro?: string; points?: string[] };
  sickEntitlementDays?: number;
}

interface CarryForwardAvailability {
  availabilityMonths: number;
  windowDescription: string;
  narrativeIntro?: string;
  narrativePoints?: string[];
}

/** In-app fallbacks; must stay aligned with `LeaveService.GetDefaultCarryForwardNarrative` in the API. */
const DEFAULT_CARRY_NARRATIVE: { intro: string; points: [string, string, string] } = {
  intro: "Not a separate leave type — unused days from a completed balance year can be moved into the next year for leave types that your policy allows (for example annual leave), up to the limits you set.",
  points: [
    "In Leave → Policies, enable Allow carry forward and set Max carry forward days (and max days per year) for that leave type.",
    "At the start of a new year, use Leave → Carry Forward to run the process: remaining days (within policy limits) are written to the new year as carried forward on the balance.",
    "Carried days are then used with the same balance, subject to that leave type’s policy and approval rules.",
  ],
};

function carryNarrativePointsTuple(raw: string[] | undefined | null): [string, string, string] {
  const a = raw ?? [];
  const t: [string, string, string] = [a[0] ?? "", a[1] ?? "", a[2] ?? ""];
  if (!t[0].trim() && !t[1].trim() && !t[2].trim()) return DEFAULT_CARRY_NARRATIVE.points;
  return t;
}

/** Display message for failed carry-forward save (403 = no permission). */
function carryForwardSaveErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/^API\s+403\b/i.test(msg) || /\b403\b/i.test(msg)) {
    return "You don't have permission to save these settings. You need Leave (organization-wide) update access or the Supervisor role.";
  }
  return msg;
}

function buildCarryWindowDescription(months: number): string {
  if (months >= 12) return "Carry-forward days may be used for the full 12 months of the balance period.";
  return `Carried-from days on a balance may only be used for leave with a start date in the first ${months} month(s) of that balance period (for a full calendar year, from 1 January). After that window, new requests are limited to standard entitlement (excluding the carried amount).`;
}

/** Handles PascalCase or camelCase API property names and fills empty narrative. */
function normalizeCarrySettingsFromApi(raw: unknown): CarryForwardAvailability {
  const r = raw as Record<string, unknown>;
  const months = Number(
    (r as { availabilityMonths?: number }).availabilityMonths ?? (r as { AvailabilityMonths?: number }).AvailabilityMonths ?? 3,
  );
  const m = Number.isFinite(months) ? Math.min(12, Math.max(1, months)) : 3;
  const fromApiIntro = (r as { narrativeIntro?: string; NarrativeIntro?: string }).narrativeIntro
    ?? (r as { NarrativeIntro?: string }).NarrativeIntro;
  const fromApiPoints = (r as { narrativePoints?: string[]; NarrativePoints?: string[] }).narrativePoints
    ?? (r as { NarrativePoints?: string[] }).NarrativePoints;
  const fromApiWd = (r as { windowDescription?: string; WindowDescription?: string }).windowDescription
    ?? (r as { WindowDescription?: string }).WindowDescription;
  const intro = (typeof fromApiIntro === "string" && fromApiIntro.trim() ? fromApiIntro : DEFAULT_CARRY_NARRATIVE.intro).trim();
  const points = carryNarrativePointsTuple(fromApiPoints);
  const windowDescription = (typeof fromApiWd === "string" && fromApiWd.trim()
    ? fromApiWd
    : buildCarryWindowDescription(m)).trim();
  return {
    availabilityMonths: m,
    windowDescription,
    narrativeIntro: intro,
    narrativePoints: [...points],
  };
}

interface RecalcResult {
  employeesProcessed: number;
  balancesCreated: number;
  balancesUpdated: number;
}

// ──────────────────────────── Tabs ────────────────────────────

type PageTab = "dashboard" | "applyLeave" | "requests" | "approvals" | "balances" | "carryForward" | "assignLeaveType" | "leaveTypes" | "policies" | "holidays" | "calendar";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "Leave Requests" },
  { key: "balances", label: "Leave Balances" },
  { key: "carryForward", label: "Carry Forward" },
  { key: "assignLeaveType", label: "Assign Leave Type" },
  { key: "leaveTypes", label: "Leave Types" },
  { key: "policies", label: "Policies" },
  { key: "holidays", label: "Holidays" },
  { key: "calendar", label: "Team Calendar" },
];

const EMPLOYEE_TABS: { key: PageTab; label: string }[] = [
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "My Leave" },
];

// Supervisor (Team scope): own leave, team approvals, and Policies (carry-forward / policy reference)
const SUPERVISOR_TABS: { key: PageTab; label: string }[] = [
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "My Leave" },
  { key: "approvals", label: "Pending Approvals" },
  { key: "policies", label: "Policies" },
];

// ──────────────────────────── Helpers ────────────────────────────

const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

const LEAVE_YEAR_FORM_OPTIONS: FormSelectOption[] = [2024, 2025, 2026, 2027].map((y) => ({
  value: String(y),
  label: String(y),
}));

const AS_OF_MONTH_FORM_OPTIONS: FormSelectOption[] = [
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function holidayIsoDate(h: HolidayItem): string {
  return h.date.split("T")[0] ?? h.date;
}

function holidayMonthFromIso(h: HolidayItem): number {
  return parseInt(holidayIsoDate(h).slice(5, 7), 10);
}

function holidayDayFromIso(h: HolidayItem): number {
  return parseInt(holidayIsoDate(h).slice(8, 10), 10);
}

function HolidaysCalendarPanel({
  year,
  items,
  onSelectHoliday,
  onAddForDate,
}: {
  year: number;
  items: HolidayItem[];
  onSelectHoliday: (item: HolidayItem) => void;
  onAddForDate: (isoDate: string) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return n.getFullYear() === year ? n.getMonth() + 1 : 1;
  });

  useEffect(() => {
    const n = new Date();
    setMonth(n.getFullYear() === year ? n.getMonth() + 1 : 1);
  }, [year]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayItem[]>();
    for (const h of items) {
      const iso = holidayIsoDate(h);
      const list = map.get(iso) ?? [];
      list.push(h);
      map.set(iso, list);
    }
    return map;
  }, [items]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 1) return;
    setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) return;
    setMonth((m) => m + 1);
  }

  function isoForDay(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-sky-50/20 to-emerald-50/20 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={prevMonth}
            disabled={month === 1}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <div className="text-center">
            <p className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{MONTH_NAMES[month - 1]} {year}</p>
            <p className="mt-0.5 text-xs text-slate-500">Click a day to add · click a holiday to edit</p>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            disabled={month === 12}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-slate-100 bg-slate-50/80">
        {DAY_NAMES_SHORT.map((dn) => (
          <div key={dn} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {dn}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[3.25rem] border-b border-r border-slate-100 bg-slate-50/40" />;
          }

          const iso = isoForDay(day);
            const dayHolidays = holidayByDate.get(iso) ?? [];
            const primaryHoliday = dayHolidays[0] ?? null;
            const holidayKind = primaryHoliday ? normalizeHolidayKind(primaryHoliday) : null;
            const styles = holidayKind ? holidayKindStyles(holidayKind) : null;
            const isToday =
            day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
          const isWeekend = idx % 7 === 0 || idx % 7 === 6;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => (primaryHoliday ? onSelectHoliday(primaryHoliday) : onAddForDate(iso))}
              className={`min-h-[3.25rem] border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-sky-50/50 ${
                isWeekend ? "bg-slate-50/30" : "bg-white"
              } ${styles?.ring ?? ""}`}
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-[#2E7BBF] text-white" : "text-slate-600"
                }`}
              >
                {day}
              </div>
              {dayHolidays.length > 0 ? (
                <div className="space-y-0.5">
                  {dayHolidays.slice(0, 2).map((holiday) => {
                    const kind = normalizeHolidayKind(holiday);
                    const chip = holidayKindStyles(kind).chip;
                    return (
                      <span
                        key={holiday.id}
                        className={`block truncate rounded-md px-1 py-0.5 text-[10px] font-semibold leading-tight ${chip}`}
                        title={holiday.name}
                      >
                        {holiday.name}
                      </span>
                    );
                  })}
                  {dayHolidays.length > 2 ? (
                    <span className="block px-1 text-[9px] font-medium text-slate-500">+{dayHolidays.length - 2} more</span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Legend</span>
        {HOLIDAY_KINDS.map((kind) => {
          const styles = holidayKindStyles(kind);
          return (
            <span key={kind} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.legendChip}`}>
              <span className={`h-2 w-2 rounded-full ${styles.legendDot}`} aria-hidden />
              {styles.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function HolidaysSummaryLists({
  year,
  items,
  onSelectHoliday,
}: {
  year: number;
  items: HolidayItem[];
  onSelectHoliday: (item: HolidayItem) => void;
}) {
  const grouped = useMemo(() => {
    const buckets: Record<HolidayKind, HolidayItem[]> = { Public: [], Mercantile: [], Poya: [], Restricted: [] };
    for (const item of items) {
      buckets[normalizeHolidayKind(item)].push(item);
    }
    for (const kind of HOLIDAY_KINDS) {
      buckets[kind].sort((a, b) => holidayIsoDate(a).localeCompare(holidayIsoDate(b)));
    }
    return buckets;
  }, [items]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {HOLIDAY_KINDS.map((kind) => {
        const styles = holidayKindStyles(kind);
        const list = grouped[kind];
        return (
          <div key={kind} className={`rounded-xl border bg-gradient-to-br to-white p-3.5 ${styles.listBorder} ${styles.listBg}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wide ${styles.listTitle}`}>
              {styles.label} ({list.length})
            </h3>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
              {list.length === 0 ? (
                <li className="text-slate-500">None for {year}.</li>
              ) : (
                list.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onSelectHoliday(h)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition ${styles.listHover}`}
                    >
                      <span className="font-medium text-slate-800">{h.name}</span>
                      <span className={`shrink-0 tabular-nums ${styles.listDate}`}>{fmtDate(h.date)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function fmtDate(d: string) {
  return formatDate(d);
}

function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <h2 className="text-[15px] font-bold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

// ──────────────────────────── Page ────────────────────────────

export default function LeavePage() {
  const searchParams = useSearchParams();
  const { getLeaveReadScope, user, hasRole } = useAuth();
  const leaveScope = getLeaveReadScope();
  /** Full HR / admin leave workspace (all tabs). */
  const isHrWideAccess = leaveScope === "All";
  /** Self-service only. */
  const isEmployeeView = Boolean(user) && leaveScope === "Own" && !isHrWideAccess;
  /** Team approvals + Policies (carry-forward); includes users with Supervisor role even if Leave Read scope is missing from the profile. */
  const isSupervisorView =
    Boolean(user) &&
    !isHrWideAccess &&
    (leaveScope === "Team" || hasRole("SUPERVISOR"));

  const [pageTab, setPageTab] = useState<PageTab>(
    isEmployeeView ? "applyLeave" : isSupervisorView ? "applyLeave" : "dashboard"
  );
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "calendar" && isHrWideAccess) {
      setPageTab("calendar");
    }
  }, [searchParams, isHrWideAccess]);

  useEffect(() => {
    const adminOnlyTabs: PageTab[] = ["dashboard", "balances", "carryForward", "assignLeaveType", "leaveTypes", "holidays", "calendar"];
    if (isEmployeeView && (adminOnlyTabs.includes(pageTab) || pageTab === "policies")) {
      setPageTab("applyLeave");
    }
    if (isSupervisorView && adminOnlyTabs.includes(pageTab)) {
      setPageTab("applyLeave");
    }
  }, [isEmployeeView, isSupervisorView, pageTab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = isEmployeeView ? EMPLOYEE_TABS : isSupervisorView ? SUPERVISOR_TABS : PAGE_TABS;
  const isOverflow = !isEmployeeView && !isSupervisorView && tabs.slice(3).some((t) => t.key === pageTab);
  const primaryTabs = isEmployeeView || isSupervisorView ? tabs : tabs.slice(0, 3);
  const overflowTabs = isEmployeeView || isSupervisorView ? [] : tabs.slice(3);

  return (
    <>
      <AppTopbar title="Leave & Absence" />

      {/* ─── Tab Navigation (Command Center–style pills; overflow panel matches Dashboard “Quick actions”) ─── */}
      <div className="relative z-40 isolate mt-6 mb-6 flex flex-wrap items-center gap-2">
        {primaryTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPageTab(t.key)}
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              pageTab === t.key
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        {!isEmployeeView && !isSupervisorView && overflowTabs.length > 0 && (
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu((p) => !p)}
              aria-expanded={showMoreMenu}
              aria-haspopup="menu"
              className={`flex items-center gap-1 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                isOverflow
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              }`}
            >
              {isOverflow ? PAGE_TABS.find((t) => t.key === pageTab)!.label : "More"}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMoreMenu && (
              <div
                className="absolute left-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/60"
                role="menu"
              >
                <div className="grid gap-0.5 px-1">
                  {overflowTabs.map((t) => {
                    const active = pageTab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPageTab(t.key);
                          setShowMoreMenu(false);
                        }}
                        className={`group flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                          active
                            ? "bg-indigo-50/80 text-indigo-900"
                            : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
                        }`}
                      >
                        <div className={`min-w-0 truncate text-sm ${active ? "font-semibold text-indigo-900" : "font-medium text-slate-700 group-hover:text-indigo-900"}`}>
                          {t.label}
                        </div>
                        <span
                          className={`shrink-0 transition group-hover:translate-x-0.5 ${active ? "text-indigo-700" : "text-slate-400 group-hover:text-indigo-700"}`}
                          aria-hidden
                        >
                          →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Tab Content ─── */}
      {pageTab === "dashboard" && (
        <DashboardTab onApplyLeave={() => setPageTab("applyLeave")} onOpenTab={(tab) => setPageTab(tab)} />
      )}
      {pageTab === "applyLeave" && <ApplyLeaveTab isEmployeeView={isEmployeeView || isSupervisorView} currentEmployeeId={user?.employeeId ?? null} />}
      {pageTab === "requests" && (
        <LeaveRequestsPanel
          onApplyLeave={() => setPageTab("applyLeave")}
          isEmployeeView={isEmployeeView || isSupervisorView}
          currentEmployeeId={user?.employeeId ?? null}
          showApprovalActions={false}
        />
      )}
      {pageTab === "approvals" && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800">Pending Approvals</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            Leave and overtime approvals are handled in one place: use{" "}
            <Link href={ROUTES.approvals} className="font-medium text-[#2E7BBF] hover:underline">
              Workforce → Approvals
            </Link>{" "}
            to review and approve or reject team leave requests.
          </p>
        </div>
      )}
      {pageTab === "balances" && <BalancesTab />}
      {pageTab === "carryForward" && <CarryForwardTab />}
      {pageTab === "assignLeaveType" && <AssignLeaveTypeTab />}
      {pageTab === "leaveTypes" && <LeaveTypesTab />}
      {pageTab === "policies" && <PoliciesTab />}
      {pageTab === "holidays" && <HolidaysTab />}
      {pageTab === "calendar" && <CalendarTab />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 – Dashboard Tab
// ═══════════════════════════════════════════════════════════════

function DashboardTab({
  onApplyLeave,
  onOpenTab,
}: {
  onApplyLeave: () => void;
  onOpenTab: (tab: PageTab) => void;
}) {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    setDashLoading(true);
    apiFetch<Dashboard>("/api/leave/dashboard")
      .then(setDash)
      .catch(() => setDash(null))
      .finally(() => setDashLoading(false));
  }, []);

  const leaveStatusBars = useMemo(() => {
    const requests = dash?.recentRequests ?? [];
    if (requests.length === 0) return [];
    const tally = new Map<string, number>();
    for (const r of requests) {
      const s = r.status || "Unknown";
      tally.set(s, (tally.get(s) ?? 0) + 1);
    }
    const colorFor = (status: string) => {
      const u = status.toLowerCase();
      if (u.includes("pending")) return "#f59e0b";
      if (u.includes("approved")) return "#22c55e";
      if (u.includes("reject")) return "#ef4444";
      if (u.includes("cancel")) return "#94a3b8";
      return "#3b82f6";
    };
    return Array.from(tally.entries())
      .map(([label, value]) => ({ label, value, color: colorFor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [dash]);

  const activityLast7Days = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, 0);
    dash?.recentRequests?.forEach((r) => {
      const k = new Date(r.createdAt).toISOString().slice(0, 10);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return keys.map((key) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0,
    }));
  }, [dash]);

  const timelineItems = useMemo(() => {
    if (!dash?.recentRequests?.length) return [];
    return [...dash.recentRequests]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((r) => ({
        at: r.createdAt,
        title: `${r.leaveTypeName} · ${r.status}`,
        body: `${r.employeeName} — ${fmtDate(r.startDate)} to ${fmtDate(r.endDate)} (${r.totalDays}d)`,
      }));
  }, [dash]);

  const kpis = useMemo(() => {
    if (!dash) return [];
    return [
      {
        label: "Total leave requests",
        value: formatInt(dash.totalRequests),
        sub: `${formatInt(dash.activeLeaveTypes)} active leave types in catalog`,
      },
      {
        label: "Pending approvals",
        value: formatInt(dash.pendingApprovals),
        sub: "Awaiting manager or HR action",
      },
      {
        label: "Approved this month",
        value: formatInt(dash.approvedThisMonth),
        sub: "Accepted in the current calendar month",
      },
      {
        label: "Upcoming holidays",
        value: formatInt(dash.upcomingHolidays),
        sub: "Scheduled company holidays ahead",
      },
    ];
  }, [dash]);

  const quickLinks: { tab: PageTab; title: string }[] = [
    { tab: "applyLeave", title: "Apply leave" },
    { tab: "requests", title: "Leave requests" },
    { tab: "balances", title: "Leave balances" },
    { tab: "holidays", title: "Holidays" },
  ];

  if (dashLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" />
        ))}
      </div>
    );
  }

  if (!dash) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500 shadow-sm">
        Unable to load leave dashboard. Check your connection and Leave module access.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Leave activity</h3>
          </div>
          <WeeklyActivityBars data={activityLast7Days} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Recent leave by status</h3>
          </div>
          {leaveStatusBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No recent requests in the sample.</p>
          ) : (
            <HorizontalCompareBars items={leaveStatusBars} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Status mix</h3>
          </div>
          {leaveStatusBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No distribution data.</p>
          ) : (
            <DonutMixChart values={leaveStatusBars} />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent leave</h3>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {timelineItems.length} shown
              </span>
              <Button
                variant="secondary"
                className="min-h-0 rounded-lg px-3 py-1.5 text-xs"
                onClick={() => onOpenTab("requests")}
              >
                All requests
              </Button>
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={onApplyLeave}>
                + New request
              </Button>
            </div>
          </div>
          {timelineItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No leave requests in the dashboard sample yet.</p>
          ) : (
            <div className="space-y-2.5">
              {timelineItems.map((ev, i) => (
                <div
                  key={`${ev.at}-${i}`}
                  className="group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="pt-0.5 text-[11px] font-medium text-slate-500">{formatDateTime(ev.at)}</div>
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <strong className="truncate text-sm text-slate-800">{ev.title}</strong>
                    </div>
                    <div className="line-clamp-2 text-sm text-slate-600">{ev.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => onOpenTab(link.tab)}
                className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{link.title}</div>
                  </div>
                  <span className="mt-0.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Apply Leave Tab
// ═══════════════════════════════════════════════════════════════

interface EmployeeLookup { id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }

interface DepartmentLookup { id: string; name: string }

/** Sparse fields from GET /api/employees?search= for coverage name suggestions */
interface EmployeeSuggestHit {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName?: string | null;
}

const BALANCE_COLORS = [
  { bg: "from-blue-500 to-blue-600", ring: "ring-blue-200" },
  { bg: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200" },
  { bg: "from-violet-500 to-violet-600", ring: "ring-violet-200" },
  { bg: "from-amber-500 to-amber-600", ring: "ring-amber-200" },
  { bg: "from-rose-500 to-rose-600", ring: "ring-rose-200" },
  { bg: "from-cyan-500 to-cyan-600", ring: "ring-cyan-200" },
  { bg: "from-fuchsia-500 to-fuchsia-600", ring: "ring-fuchsia-200" },
];

function ApplyLeaveTab({ isEmployeeView, currentEmployeeId }: { isEmployeeView: boolean; currentEmployeeId: string | null }) {
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [departmentFilterId, setDepartmentFilterId] = useState("");
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState(isEmployeeView && currentEmployeeId ? currentEmployeeId : "");
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [coveragePerson, setCoveragePerson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const [medicalDrag, setMedicalDrag] = useState(false);
  const medicalInputId = useId();
  const coverageInputId = useId();
  const coverageListId = useId();
  const coverageWrapRef = useRef<HTMLDivElement>(null);
  const coverageDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageHits, setCoverageHits] = useState<EmployeeSuggestHit[]>([]);
  const currentYear = new Date().getFullYear();
  const todayMinDate = useMemo(() => formatLocalDateToIso(new Date()), []);

  function onApplyStartDateChange(iso: string) {
    setStartDate(iso);
    if (iso && endDate && endDate < iso) setEndDate("");
  }

  function onApplyEndDateChange(iso: string) {
    setEndDate(iso);
  }

  const applyEndMinDate = startDate && startDate > todayMinDate ? startDate : todayMinDate;
  const applyDatesInvalid =
    Boolean(startDate && endDate && (startDate < todayMinDate || endDate < todayMinDate || endDate < startDate));

  const catalogLeaveTypes = useMemo(
    () => [...leaveTypes].filter((t) => t.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [leaveTypes]
  );

  const departmentFilterOptions = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments],
  );

  function onDepartmentFilterChange(nextDepartmentId: string) {
    setDepartmentFilterId(nextDepartmentId);
    setSelectedEmpId("");
    setSelectedTypeId("");
    setMessage(null);
  }

  /** Maternity only appears once HR has assigned a balance for that employee (same as catalog row). */
  const leaveTypesForApply = useMemo(() => {
    return catalogLeaveTypes.filter((t) => {
      if (t.code?.toUpperCase() !== "LT-MAT") return true;
      return balances.some(
        (x) => (x.leaveTypeId && x.leaveTypeId === t.id) || x.leaveTypeName === t.name
      );
    });
  }, [catalogLeaveTypes, balances]);

  useEffect(() => {
    if (!selectedTypeId) return;
    if (leaveTypesForApply.some((t) => t.id === selectedTypeId)) return;
    setSelectedTypeId("");
    setMessage(null);
  }, [selectedTypeId, leaveTypesForApply]);

  useEffect(() => {
    setMedicalFile(null);
    setMedicalDrag(false);
  }, [selectedTypeId]);

  useEffect(
    () => () => {
      if (coverageDebounceRef.current) clearTimeout(coverageDebounceRef.current);
    },
    []
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!coverageWrapRef.current?.contains(e.target as Node)) setCoverageOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const fetchCoverageSuggestions = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (q.length < 2) {
        setCoverageHits([]);
        setCoverageOpen(false);
        return;
      }
      setCoverageLoading(true);
      try {
        const res = await apiFetch<{ items: EmployeeSuggestHit[] }>(
          `/api/employees?search=${encodeURIComponent(q)}&pageSize=12&excludeTerminated=true`
        );
        let items = res.items ?? [];
        if (selectedEmpId) items = items.filter((h) => h.id !== selectedEmpId);
        setCoverageHits(items);
        setCoverageOpen(items.length > 0);
      } catch {
        setCoverageHits([]);
        setCoverageOpen(false);
      } finally {
        setCoverageLoading(false);
      }
    },
    [selectedEmpId]
  );

  function onCoverageInputChange(next: string) {
    const sanitized = sanitizeSearchInput(next);
    setCoveragePerson(sanitized);
    if (coverageDebounceRef.current) clearTimeout(coverageDebounceRef.current);
    const t = sanitized.trim();
    if (t.length < 2) {
      setCoverageHits([]);
      setCoverageOpen(false);
      return;
    }
    coverageDebounceRef.current = setTimeout(() => {
      void fetchCoverageSuggestions(sanitized);
    }, 280);
  }

  function pickCoverageHit(hit: EmployeeSuggestHit) {
    const label = hit.employeeCode?.trim()
      ? `${hit.fullName.trim()} (${hit.employeeCode.trim()})`
      : hit.fullName.trim();
    setCoveragePerson(label);
    setCoverageHits([]);
    setCoverageOpen(false);
  }

  useEffect(() => {
    if (isEmployeeView && currentEmployeeId) setSelectedEmpId(currentEmployeeId);
  }, [isEmployeeView, currentEmployeeId]);

  useEffect(() => {
    Promise.all([
      isEmployeeView && currentEmployeeId
        ? apiFetch<{ id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }>(`/api/employees/${currentEmployeeId}`)
            .then((e) => [{ id: e.id, firstName: e.firstName, lastName: e.lastName, profileImageUrl: e.profileImageUrl, employeeCode: e.employeeCode }])
        : isEmployeeView
          ? Promise.resolve([] as EmployeeLookup[])
          : apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=200").then((r) => r.items ?? []),
      apiFetch<LeaveTypeItem[]>("/api/leave/types"),
      !isEmployeeView
        ? apiFetch<DepartmentLookup[]>("/api/organization/departments").catch(() => [] as DepartmentLookup[])
        : Promise.resolve([] as DepartmentLookup[]),
    ]).then(([empList, types, deptList]) => {
      setEmployees(empList);
      setLeaveTypes(types);
      setDepartments(deptList);
    });
  }, [isEmployeeView, currentEmployeeId]);

  useEffect(() => {
    if (!selectedEmpId) { setBalances([]); return; }
    setLoadingBal(true);
    apiFetch<BalanceItem[]>(`/api/leave/balances/${selectedEmpId}?year=${currentYear}`)
      .then(setBalances)
      .catch(() => setBalances([]))
      .finally(() => setLoadingBal(false));
  }, [selectedEmpId, currentYear]);

  useEffect(() => {
    setCoverageHits([]);
    setCoverageOpen(false);
  }, [selectedEmpId]);

  const totalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;

  const selectedLeaveType = leaveTypes.find((t) => t.id === selectedTypeId);
  const selectedBalance = selectedLeaveType
    ? balances.find(
        (b) =>
          (b.leaveTypeId && b.leaveTypeId === selectedLeaveType.id) || b.leaveTypeName === selectedLeaveType.name
      )
    : undefined;
  const isNoPayLeave = selectedLeaveType?.code?.toUpperCase() === "LT-NPL";
  const isSickLeave = selectedLeaveType?.code?.toUpperCase() === "LT-SIC";
  /** More than 2 calendar days of sick leave requires a medical certificate PDF. */
  const sickLeaveRequiresMedicalPdf = isSickLeave && totalDays > 2;
  /** Sick leave can be applied even when no balance row exists; all other paid types need an assigned balance. */
  const allowApplyWithoutAssignedBalance = isNoPayLeave || isSickLeave;
  const missingBalance = Boolean(
    selectedLeaveType && !allowApplyWithoutAssignedBalance && !selectedBalance
  );
  const exceedsBalance =
    !isNoPayLeave && selectedBalance ? totalDays > selectedBalance.remaining : false;

  const pickMedical = useCallback((file: File | null) => {
    if (!file) {
      setMedicalFile(null);
      return;
    }
    const ok = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ok) {
      setMessage({ type: "err", text: "Please upload a PDF file for the medical certificate." });
      return;
    }
    setMedicalFile(file);
    setMessage(null);
  }, []);

  function resetApplyLeaveForm() {
    setSelectedTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setCoveragePerson("");
    setCoverageHits([]);
    setCoverageOpen(false);
    setMedicalFile(null);
    setMedicalDrag(false);
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (missingBalance) {
      setMessage({
        type: "err",
        text: `No leave balance is assigned for this type for ${currentYear}. Ask HR to assign a balance before applying.`,
      });
      return;
    }
    if (sickLeaveRequiresMedicalPdf && !medicalFile) {
      setMessage({
        type: "err",
        text: "Sick leave longer than 2 calendar days requires a medical certificate (PDF).",
      });
      return;
    }
    if (exceedsBalance && selectedBalance) {
      setMessage({
        type: "err",
        text: `Insufficient leave balance. Available: ${selectedBalance.remaining} days, requested: ${totalDays} days.`,
      });
      return;
    }
    if (!startDate || !endDate) {
      setMessage({ type: "err", text: "Select both From and To dates." });
      return;
    }
    if (startDate < todayMinDate || endDate < todayMinDate) {
      setMessage({ type: "err", text: "Leave cannot be applied for past dates. Choose today or a future date." });
      return;
    }
    if (endDate < startDate) {
      setMessage({ type: "err", text: "To date cannot be before From date." });
      return;
    }
    const typeName = selectedLeaveType?.name ?? "leave";
    if (
      !(await appConfirm(
        `Submit this ${totalDays}-day ${typeName} request from ${startDate} to ${endDate}? It will go to your approver if required.`,
        "Submit Leave Request"
      ))
    ) {
      return;
    }
    setMessage(null);
    setSubmitting(true);
    try {
      if (isSickLeave && medicalFile) {
        const fd = new FormData();
        fd.set("employeeId", selectedEmpId);
        fd.set("leaveTypeId", selectedTypeId);
        fd.set("startDate", startDate);
        fd.set("endDate", endDate);
        fd.set("totalDays", String(totalDays));
        if (reason.trim()) fd.set("reason", reason.trim());
        if (coveragePerson.trim()) fd.set("coveragePerson", coveragePerson.trim());
        fd.set("medicalCertificate", medicalFile, medicalFile.name);
        await apiFetch("/api/leave/requests/with-document", { method: "POST", body: fd });
      } else {
        await apiFetch("/api/leave/requests", {
          method: "POST",
          body: JSON.stringify({
            employeeId: selectedEmpId,
            leaveTypeId: selectedTypeId,
            startDate,
            endDate,
            totalDays,
            reason: reason || null,
            coveragePerson: coveragePerson || null,
          }),
        });
      }
      setMessage({ type: "ok", text: "Leave request submitted successfully!" });
      await appAlert("Leave request submitted successfully!", "Success");
      setSelectedTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setCoveragePerson("");
      setCoverageHits([]);
      setCoverageOpen(false);
      setMedicalFile(null);
      apiFetch<BalanceItem[]>(`/api/leave/balances/${selectedEmpId}?year=${currentYear}`).then(setBalances);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to submit request" });
      await appAlert(err instanceof Error ? err.message : "Failed to submit request", "Submission Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const apiOrigin = API_BASE_URL.replace(/\/$/, "");
  const applyLabel = "mb-0.5 block text-[11px] font-medium text-slate-500";
  const applyInput =
    "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

  return (
    <div className="w-full max-w-[min(100%,88rem)]">
      <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800 sm:text-base">Apply leave</h2>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">
            {isEmployeeView
              ? "Pick a leave type, then dates and submit — one screen."
              : "Choose an employee, then a leave type and request details."}
          </p>
        </div>
        {!isEmployeeView && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-lg sm:flex-row sm:items-center">
            <FormSelect
              value={departmentFilterId}
              onValueChange={onDepartmentFilterChange}
              options={departmentFilterOptions}
              className="w-full sm:w-44"
              clearable={false}
            />
            <EmployeeSearchCombobox
              key={departmentFilterId || "all-departments"}
              value={selectedEmpId}
              departmentId={departmentFilterId || undefined}
              placeholder="Type name or employee code…"
              className="w-full sm:min-w-[220px] sm:flex-1"
              onPick={(emp) => {
                setSelectedEmpId(emp?.id ?? "");
                setSelectedTypeId("");
                setMessage(null);
                if (emp) {
                  setEmployees((prev) => (prev.some((e) => e.id === emp.id) ? prev : [...prev, emp]));
                }
              }}
            />
          </div>
        )}
        {isEmployeeView && !currentEmployeeId && (
          <p className="text-xs text-amber-700">Account not linked to an employee profile.</p>
        )}
      </div>

      {selectedEmpId && (
        <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-4">
          <div className="flex min-h-0 flex-col gap-2 lg:col-span-4 xl:col-span-3">
            {selectedEmp && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                  {selectedEmp.profileImageUrl ? (
                    <img
                      src={
                        /^https?:\/\//i.test(selectedEmp.profileImageUrl)
                          ? selectedEmp.profileImageUrl
                          : `${apiOrigin}${selectedEmp.profileImageUrl.startsWith("/") ? "" : "/"}${selectedEmp.profileImageUrl}`
                      }
                      alt=""
                      className="h-10 w-10 object-cover"
                    />
                  ) : (
                    `${selectedEmp.firstName[0]}${selectedEmp.lastName[0]}`
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selectedEmp.firstName} {selectedEmp.lastName}
                  </p>
                  <p className="text-[10px] text-slate-400">{currentYear} balances · click a row to select</p>
                </div>
              </div>
            )}

            {loadingBal && <p className="py-2 text-center text-xs text-slate-400">Loading balances…</p>}
            {!loadingBal && catalogLeaveTypes.length === 0 && selectedEmpId && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                No active leave types in the catalog. Add types under <span className="font-medium">Leave Types</span> (admin).
              </p>
            )}
            {!loadingBal && catalogLeaveTypes.length > 0 && leaveTypesForApply.length === 0 && selectedEmpId && (
              <p className="rounded-lg border border-dashed border-amber-100 bg-amber-50/80 px-3 py-4 text-center text-xs text-amber-900">
                No leave types you can apply for yet for {currentYear}. HR must assign leave types (for example Maternity)
                under <span className="font-medium">Leave balances</span> before they appear here.
              </p>
            )}
            {!loadingBal && leaveTypesForApply.length > 0 && (
              <div className="max-h-[32vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-h-[min(52vh,28rem)]">
                <p className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Leave types
                </p>
                <p className="border-b border-slate-100 bg-slate-50/90 px-2.5 py-1 text-[10px] font-medium text-slate-500">Name</p>
                <ul className="divide-y divide-slate-100 p-1">
                  {leaveTypesForApply.map((t, i) => {
                    const color = BALANCE_COLORS[i % BALANCE_COLORS.length];
                    const b = balances.find(
                      (x) => (x.leaveTypeId && x.leaveTypeId === t.id) || x.leaveTypeName === t.name
                    );
                    const cfOpening =
                      b != null
                        ? Math.max(Number(b.broughtForwardDays ?? 0), Number(b.carriedForward ?? 0))
                        : 0;
                    const carryExpired = b != null && cfOpening > 0 && Number(b.carriedForward ?? 0) < cfOpening;
                    const isNoPayRow = t.code?.toUpperCase() === "LT-NPL";
                    const isSickRow = t.code?.toUpperCase() === "LT-SIC";
                    const catalogMaxDays = Number.isFinite(t.defaultDaysPerYear) ? t.defaultDaysPerYear : 0;
                    const rowDisabled = !isNoPayRow && !b && !isSickRow;
                    const isSelected = t.id === selectedTypeId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          disabled={rowDisabled}
                          onClick={() => setSelectedTypeId(t.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isSelected
                              ? `bg-gradient-to-r ${color.bg} text-white shadow-sm`
                              : "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-xs font-semibold ${isSelected ? "text-white" : "text-slate-700"}`}
                            >
                              {t.name}
                            </p>
                            <p className={`text-[10px] ${isSelected ? "text-white/75" : "text-slate-400"}`}>
                              {b ? (
                                <>
                                  Ent. {b.entitled} · Used {b.used}
                                  {cfOpening > 0
                                    ? ` · CF ${cfOpening}${carryExpired ? " (expired)" : ""}`
                                    : ""}
                                </>
                              ) : isNoPayRow ? (
                                <>Unpaid — no balance pool</>
                              ) : isSickRow ? (
                                <>
                                  PDF required if &gt; 2 days · balance optional
                                  {catalogMaxDays > 0 ? (
                                    <> · type default {catalogMaxDays}d/year</>
                                  ) : null}
                                </>
                              ) : (
                                <>No balance for {currentYear}</>
                              )}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 tabular-nums text-lg font-bold ${isSelected ? "text-white" : "text-slate-800"}`}
                          >
                            {b ? b.remaining : "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!loadingBal && balances.length === 0 && (
                  <p className="border-t border-slate-100 px-2.5 py-2 text-[10px] leading-snug text-slate-500">
                    No leave balances for {currentYear}. Check the employee join date and entitlement rules, or ask HR to assign balances manually.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 lg:col-span-8 xl:col-span-9">
            {!selectedTypeId && leaveTypesForApply.length > 0 && (
              <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center lg:min-h-[min(52vh,28rem)]">
                <p className="max-w-sm text-sm text-slate-500">
                  Select a <span className="font-medium text-slate-700">leave type</span> from the list to open the
                  request form.
                </p>
              </div>
            )}

          {selectedTypeId && (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 space-y-3"
            >
              <FlashMessageBanner
                msg={message}
                onClear={() => setMessage(null)}
                className=""
              />

              {isNoPayLeave && selectedLeaveType && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/80 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedLeaveType.name}</span>
                  <span className="text-[11px] text-slate-600">No-pay leave does not use an annual balance pool.</span>
                </div>
              )}

              {isSickLeave && selectedLeaveType && !selectedBalance && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedLeaveType.name}</span>
                  <span className="text-[11px] text-slate-600">
                    No balance row for {currentYear} — you can still submit. A medical certificate (PDF) is required when
                    the absence is more than 2 calendar days. If HR assigns a balance later, limits will apply
                    automatically.
                  </span>
                </div>
              )}

              {selectedBalance && !isNoPayLeave && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/80 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedBalance.leaveTypeName}</span>
                  <span className="hidden h-4 w-px bg-slate-200 sm:block" />
                  <span className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Avail.</span>{" "}
                    <span className="font-bold text-blue-600">{selectedBalance.remaining}d</span>
                  </span>
                  {totalDays > 0 && (
                    <>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">Req.</span>{" "}
                        <span
                          className={`font-bold ${totalDays > selectedBalance.remaining ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {totalDays}d
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">After</span>{" "}
                        <span
                          className={`font-bold ${selectedBalance.remaining - totalDays < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {selectedBalance.remaining - totalDays}d
                        </span>
                      </span>
                    </>
                  )}
                </div>
              )}

              {missingBalance && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  No leave balance for this type for {currentYear}. Ask HR to assign a balance before submitting.
                </div>
              )}

              {exceedsBalance && totalDays > 0 && selectedBalance && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Not enough balance: {selectedBalance.remaining} available vs {totalDays} requested.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={applyLabel}>From *</label>
                  <DatePickerField
                    required
                    value={startDate}
                    min={todayMinDate}
                    onChange={onApplyStartDateChange}
                    className={applyInput}
                  />
                </div>
                <div>
                  <label className={applyLabel}>To *</label>
                  <DatePickerField
                    required
                    value={endDate}
                    min={applyEndMinDate}
                    onChange={onApplyEndDateChange}
                    className={applyInput}
                  />
                </div>
              </div>
              {applyDatesInvalid && (
                <p className="text-xs text-red-600">Dates must be today or later, and To must be on or after From.</p>
              )}

              {isSickLeave && (
                <div>
                  <label className={`${applyLabel} text-slate-700`} htmlFor={medicalInputId}>
                    Medical certificate (PDF)
                    {sickLeaveRequiresMedicalPdf ? (
                      <span className="text-red-500"> *</span>
                    ) : (
                      <span className="font-normal text-slate-400"> — optional for 1–2 day sick leave</span>
                    )}
                  </label>
                  <input
                    id={medicalInputId}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => pickMedical(e.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor={medicalInputId}
                    onDragOver={(ev) => {
                      ev.preventDefault();
                      setMedicalDrag(true);
                    }}
                    onDragLeave={() => setMedicalDrag(false)}
                    onDrop={(ev) => {
                      ev.preventDefault();
                      setMedicalDrag(false);
                      const f = ev.dataTransfer.files?.[0];
                      if (f) pickMedical(f);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition sm:px-6 sm:py-10 ${
                      medicalDrag ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-slate-50/80 hover:border-slate-400"
                    }`}
                  >
                    <svg className="mb-2 h-9 w-9 text-blue-600 sm:mb-3 sm:h-10 sm:w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    <span className="text-xs font-medium text-slate-800 sm:text-sm">
                      Click or drag a PDF here {sickLeaveRequiresMedicalPdf ? "(required for this duration)" : ""}.
                    </span>
                    <span className="mt-1 text-[10px] text-slate-500 sm:text-xs">
                      Required when sick leave is more than 2 calendar days.
                    </span>
                    {medicalFile ? (
                      <span className="mt-2 break-all font-mono text-xs text-blue-700 sm:text-sm">{medicalFile.name}</span>
                    ) : null}
                  </label>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className={applyLabel}>Comments</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className={applyInput + " min-h-[2.5rem] resize-y"}
                    placeholder="Optional"
                  />
                </div>
                <div className="relative" ref={coverageWrapRef}>
                  <label className={applyLabel} htmlFor={coverageInputId}>
                    Coverage person
                  </label>
                  <div className="relative">
                    <input
                      id={coverageInputId}
                      type="text"
                      value={coveragePerson}
                      onChange={(e) => onCoverageInputChange(e.target.value)}
                      onFocus={() => {
                        if (coverageHits.length > 0) setCoverageOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setCoverageOpen(false);
                      }}
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={coverageOpen}
                      aria-controls={coverageListId}
                      className={applyInput + " pr-[5.25rem]"}
                      placeholder="Start typing a colleague’s name…"
                    />
                    {coverageLoading && (
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                        Search…
                      </span>
                    )}
                  </div>
                  {coverageOpen && coverageHits.length > 0 && (
                    <ul
                      id={coverageListId}
                      role="listbox"
                      className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    >
                      {coverageHits.map((hit) => (
                        <li key={hit.id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickCoverageHit(hit)}
                          >
                            <span className="font-medium text-slate-800">{hit.fullName}</span>
                            <span className="text-[11px] text-slate-500">
                              {[hit.employeeCode ? hit.employeeCode : null, hit.departmentName?.trim() || null]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={resetApplyLeaveForm}
                  disabled={submitting}
                  className="inline-flex min-w-[8.5rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !startDate ||
                    !endDate ||
                    applyDatesInvalid ||
                    exceedsBalance ||
                    missingBalance ||
                    (sickLeaveRequiresMedicalPdf && !medicalFile)
                  }
                  className="inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                >
                  {submitting && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 3 – Leave Balances Tab
// ═══════════════════════════════════════════════════════════════

function BalancesTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [asOfMonth, setAsOfMonth] = useState(now.getMonth() + 1);
  const [summaries, setSummaries] = useState<BalanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState("");

  const [editingBalance, setEditingBalance] = useState<BalanceItem | null>(null);
  const [editEntitled, setEditEntitled] = useState("0");
  const [editUsed, setEditUsed] = useState("0");
  const [editCarriedForward, setEditCarriedForward] = useState("0");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => [
      { value: 1, label: "Jan" },
      { value: 2, label: "Feb" },
      { value: 3, label: "Mar" },
      { value: 4, label: "Apr" },
      { value: 5, label: "May" },
      { value: 6, label: "Jun" },
      { value: 7, label: "Jul" },
      { value: 8, label: "Aug" },
      { value: 9, label: "Sep" },
      { value: 10, label: "Oct" },
      { value: 11, label: "Nov" },
      { value: 12, label: "Dec" },
    ],
    [],
  );
  const asOfMonthLabel = monthOptions.find((m) => m.value === asOfMonth)?.label ?? `Month ${asOfMonth}`;

  const loadBalances = useCallback(() => {
    setLoading(true);
    apiFetch<BalanceSummary[]>(`/api/leave/balances/summary?year=${year}&asOfMonth=${asOfMonth}`)
      .then(setSummaries)
      .finally(() => setLoading(false));
  }, [year, asOfMonth]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  const summariesPager = useClientPagination(summaries, 15);

  async function handleRecalculate() {
    setRecalculating(true);
    setRecalcMsg("");
    try {
      const res = await apiFetch<RecalcResult>(`/api/leave/recalculate-all?year=${year}`, { method: "POST" });
      setRecalcMsg(`Done! ${res.employeesProcessed} employees processed, ${res.balancesCreated} created, ${res.balancesUpdated} updated.`);
      loadBalances();
    } catch { setRecalcMsg("Recalculation failed."); }
    finally { setRecalculating(false); }
  }

  function openEditBalance(b: BalanceItem) {
    setEditingBalance(b);
    setEditEntitled(String(b.entitled));
    setEditUsed(String(b.used));
    setEditCarriedForward(String(b.carriedForward));
    setBalanceError(null);
  }

  async function submitEditBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBalance) return;
    setBalanceSaving(true);
    setBalanceError(null);
    try {
      await apiFetch(`/api/leave/balances/${editingBalance.id}`, {
        method: "PUT",
        body: JSON.stringify({
          entitled: Number(editEntitled) || 0,
          used: Number(editUsed) || 0,
          carriedForward: Number(editCarriedForward) || 0,
        }),
      });
      setEditingBalance(null);
      loadBalances();
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : "Failed to update balance");
    } finally {
      setBalanceSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>Year</label>
            <FormSelect
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              options={LEAVE_YEAR_FORM_OPTIONS}
              className="w-36"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>As-of month</label>
            <FormSelect
              value={String(asOfMonth)}
              onValueChange={(v) => setAsOfMonth(Number(v))}
              options={AS_OF_MONTH_FORM_OPTIONS}
              className="w-32"
              clearable={false}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-3 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
          {recalcMsg && (
            <div
              className={
                `flex min-w-0 items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${
                  recalcMsg.startsWith("Done")
                    ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white text-emerald-900"
                    : "border-rose-200/80 bg-gradient-to-r from-rose-50/90 to-white text-rose-800"
                }`
              }
            >
              {recalcMsg.startsWith("Done") ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </span>
              ) : (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700" aria-hidden>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              )}
              <p className="min-w-0 leading-relaxed">{recalcMsg}</p>
            </div>
          )}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-sky-50/80 px-4 py-2.5 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:from-sky-100/90 hover:to-sky-50 disabled:opacity-50"
            type="button"
          >
            {recalculating && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-800" aria-hidden />}
            {recalculating ? "Recalculating…" : "Recalculate Balances"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
        <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50/30 to-sky-50/20 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Leave Balances — {year} (as of {asOfMonthLabel})</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Entitlement, usage, and days remaining. <span className="font-medium text-slate-600">Carried</span> is the
            usable carry pool (it goes to 0 after the configured use-months window if unused). Values are shown for the selected month. Rows are grouped by employee.
          </p>
        </div>
        <div className="max-h-[min(70vh,48rem)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  className="sticky top-0 z-10 min-w-[10rem] border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur sm:pl-5"
                  scope="col"
                >
                  Leave type
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[6.5rem] border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Period
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Entitled
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Used
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Carried
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[5.5rem] border-b-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-slate-100/95 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-800 backdrop-blur"
                  scope="col"
                >
                  Remaining
                </th>
                <th
                  className="sticky top-0 z-10 w-11 border-b border-slate-200/90 bg-slate-100/95 py-3 pl-1 pr-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur sm:pr-3"
                  scope="col"
                  aria-label="Actions"
                />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-500">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                      <span>Loading balances…</span>
                    </div>
                    </td>
                  </tr>
              )}
              {!loading && summaries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="text-sm text-slate-500">No balances for <span className="font-semibold text-slate-700">{year}</span> as of <span className="font-semibold text-slate-700">{asOfMonthLabel}</span>.</p>
                    <p className="mt-1 text-xs text-slate-400">Assign leave types or run recalculation to populate this view.</p>
                  </td>
                </tr>
              )}
              {!loading &&
                summariesPager.pageItems.map((s) => (
                  <Fragment key={s.employeeId}>
                    <tr className="hover:bg-slate-50/30">
                      <td colSpan={7} className="border-b border-slate-200/80 bg-gradient-to-r from-slate-100/80 via-slate-50/50 to-white px-4 py-2.5 sm:px-6">
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-800">{s.employeeName}</span>
                            {s.employeeCode ? <span className="ml-2 text-xs font-medium text-slate-500 tabular-nums">{s.employeeCode}</span> : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {s.balances.map((b) => {
                      const rem = b.remaining;
                      const remClass =
                        rem > 0 ? "text-emerald-800" : rem < 0 ? "text-rose-700" : "text-slate-500";
                      return (
                        <tr
                          key={`${s.employeeId}-${b.id}`}
                          className="group border-b border-slate-100/90 transition hover:bg-sky-50/35"
                        >
                          <td className="border-l-4 border-sky-400/45 bg-slate-50/25 py-2.5 pl-3 pr-2 align-middle transition group-hover:border-sky-500/60 group-hover:bg-sky-50/20 sm:pl-4 sm:pr-3">
                            <span className="font-medium text-slate-800">{b.leaveTypeName}</span>
                          </td>
                          <td className="px-2 py-2.5 align-middle sm:px-3">
                            <span className="inline-flex max-w-full items-center rounded-lg bg-slate-100/80 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              {b.periodLabel ?? b.year}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 sm:px-3">{b.entitled}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 sm:px-3">{b.used}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-500 sm:px-3">{b.carriedForward}</td>
                          <td className="min-w-[5.5rem] border-l-2 border-emerald-200/50 bg-gradient-to-l from-emerald-50/50 to-transparent px-2 py-2.5 text-right sm:px-3">
                            <span className={`text-base font-semibold tabular-nums ${remClass}`}>{b.remaining}</span>
                          </td>
                          <td className="w-11 py-2.5 pl-0 pr-1 text-right sm:pr-3">
                            <button
                              type="button"
                              onClick={() => openEditBalance(b)}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
                              title="Edit this balance"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                                />
                              </svg>
                              <span className="sr-only">Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={summariesPager.page} totalPages={summariesPager.totalPages} totalCount={summariesPager.totalCount} pageSize={summariesPager.pageSize} onPageChange={summariesPager.setPage} />
      </div>

      <Modal open={!!editingBalance} onClose={() => setEditingBalance(null)} title={`Edit balance: ${editingBalance?.leaveTypeName ?? ""}`}>
        <form onSubmit={submitEditBalance} className="space-y-4">
          <FormErrorAlert message={balanceError} onDismiss={() => setBalanceError(null)} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entitled (days)</label>
              <input type="number" min={0} step={0.5} value={editEntitled} onChange={(e) => setEditEntitled(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Used</label>
              <input type="number" min={0} step={0.5} value={editUsed} onChange={(e) => setEditUsed(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Carried Forward</label>
              <input type="number" min={0} step={0.5} value={editCarriedForward} onChange={(e) => setEditCarriedForward(e.target.value)} className={inputClass + " w-full"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingBalance(null)}>Cancel</Button>
            <Button type="submit" disabled={balanceSaving}>{balanceSaving ? "Saving..." : "Update"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Assign Leave Type (admin — create balance row)
// ═══════════════════════════════════════════════════════════════

function AssignLeaveTypeTab() {
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; employeeCode?: string }[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addLeaveTypeId, setAddLeaveTypeId] = useState("");
  const [addPeriodKind, setAddPeriodKind] = useState<"year" | "custom">("year");
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addPeriodStart, setAddPeriodStart] = useState("");
  const [addPeriodEnd, setAddPeriodEnd] = useState("");
  const [addEntitled, setAddEntitled] = useState("0");
  const [addUsed, setAddUsed] = useState("0");
  const [addCarriedForward, setAddCarriedForward] = useState("0");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const addEmployeeFormOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Select employee…" },
      ...employees.map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}${e.employeeCode ? ` (${e.employeeCode})` : ""}`,
      })),
    ],
    [employees]
  );

  const addLeaveTypeFormOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Select leave type…" },
      ...leaveTypes.map((t) => ({ value: t.id, label: t.name })),
    ],
    [leaveTypes]
  );

  const addYearFormOptions = LEAVE_YEAR_FORM_OPTIONS;

  useEffect(() => {
    setCatalogLoading(true);
    Promise.all([
      apiFetch<{ items: { id: string; firstName: string; lastName: string; employeeCode?: string }[] }>("/api/employees?pageSize=500").then((r) => r.items),
      apiFetch<LeaveTypeItem[]>("/api/leave/types"),
    ])
      .then(([emps, types]) => {
        setEmployees(emps);
        setLeaveTypes(types);
      })
      .catch(() => setFormError("Could not load employees or leave types."))
      .finally(() => setCatalogLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (addPeriodKind === "custom" && (!addPeriodStart || !addPeriodEnd)) {
      setFormError("Please enter both period start and end dates.");
      return;
    }
    if (addPeriodKind === "custom" && addPeriodStart > addPeriodEnd) {
      setFormError("Period start must be before or equal to period end.");
      return;
    }
    setSaving(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      const payload: Record<string, unknown> = {
        employeeId: addEmployeeId,
        leaveTypeId: addLeaveTypeId,
        entitled: Number(addEntitled) || 0,
        used: Number(addUsed) || 0,
        carriedForward: Number(addCarriedForward) || 0,
      };
      if (addPeriodKind === "year") {
        payload.year = addYear;
      } else {
        payload.periodStart = addPeriodStart;
        payload.periodEnd = addPeriodEnd;
      }
      await apiFetch("/api/leave/balances", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAddEmployeeId("");
      setAddLeaveTypeId("");
      setAddPeriodKind("year");
      setAddYear(new Date().getFullYear());
      setAddPeriodStart("");
      setAddPeriodEnd("");
      setAddEntitled("0");
      setAddUsed("0");
      setAddCarriedForward("0");
      setSuccessMsg("Balance line created. Open “Leave Balances” (from More) to review and edit if needed.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add balance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-800">Assign leave type</h2>
        <p className="mb-6 text-sm text-slate-600">
          Create a leave balance line for a specific employee and leave type, for a calendar year or a custom period. Use
          <span className="font-medium"> Leave Balances</span> to view the grid and run recalculation.
        </p>
        {catalogLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading employees and leave types…</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
            <FormErrorAlert message={formError} onDismiss={() => setFormError(null)} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" />
            <InlinePageAlert message={successMsg} variant="success" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 scroll-mt-20" />
          <div>
            <label className={labelClass}>Employee *</label>
            <FormSelect
              value={addEmployeeId}
              onValueChange={setAddEmployeeId}
              options={addEmployeeFormOptions}
              placeholder="Select employee…"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Leave Type *</label>
            <FormSelect
              value={addLeaveTypeId}
              onValueChange={setAddLeaveTypeId}
              options={addLeaveTypeFormOptions}
              placeholder="Select leave type…"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Leave period *</label>
            <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="periodKindAssign"
                      checked={addPeriodKind === "year"}
                      onChange={() => setAddPeriodKind("year")}
                      className="rounded border-slate-300 text-blue-600"
                    />
                  <span className="text-sm text-slate-700">Calendar year</span>
                </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="periodKindAssign"
                      checked={addPeriodKind === "custom"}
                      onChange={() => setAddPeriodKind("custom")}
                      className="rounded border-slate-300 text-blue-600"
                    />
                  <span className="text-sm text-slate-700">Custom period</span>
                </label>
              </div>
              {addPeriodKind === "year" ? (
                <FormSelect
                  value={String(addYear)}
                  onValueChange={(v) => setAddYear(Number(v))}
                  options={addYearFormOptions}
                  placeholder={String(addYear)}
                />
              ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">From</label>
                    <DatePickerField value={addPeriodStart} onChange={setAddPeriodStart} className={inputClass + " w-full"} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">To</label>
                    <DatePickerField value={addPeriodEnd} onChange={setAddPeriodEnd} className={inputClass + " w-full"} />
                  </div>
                </div>
              )}
            </div>
          </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Entitled (days)</label>
              <input type="number" min={0} step={0.5} value={addEntitled} onChange={(e) => setAddEntitled(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Used</label>
              <input type="number" min={0} step={0.5} value={addUsed} onChange={(e) => setAddUsed(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Carried Forward</label>
              <input type="number" min={0} step={0.5} value={addCarriedForward} onChange={(e) => setAddCarriedForward(e.target.value)} className={inputClass + " w-full"} />
            </div>
          </div>
            <div className="pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Assign leave type"}
              </Button>
          </div>
        </form>
        )}
            </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Carry Forward Tab (run at beginning of new year)
// ═══════════════════════════════════════════════════════════════

interface CarryForwardResult {
  fromYear: number;
  toYear: number;
  balancesProcessed: number;
  balancesUpdated: number;
  balancesCreated: number;
  totalDaysCarried: number;
  infoMessage?: string | null;
}

function CarryForwardTab() {
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [toYear, setToYear] = useState(currentYear);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CarryForwardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; employeeCode?: string }[]>([]);
  const [includeById, setIncludeById] = useState<Record<string, boolean>>({});
  const [empLoading, setEmpLoading] = useState(true);
  const [availableByEmployeeId, setAvailableByEmployeeId] = useState<Record<string, number>>({});
  const [balanceLoading, setBalanceLoading] = useState(true);
  const headerIncludeRef = useRef<HTMLInputElement>(null);

  const fromYearOptions = useMemo<FormSelectOption[]>(
    () => [currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map((y) => ({ value: String(y), label: String(y) })),
    [currentYear],
  );

  const toYearOptions = useMemo<FormSelectOption[]>(
    () => [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) })),
    [currentYear],
  );

  useEffect(() => {
    setToYear(fromYear + 1);
  }, [fromYear]);

  useEffect(() => {
    setEmpLoading(true);
    apiFetch<{ items: { id: string; firstName: string; lastName: string; employeeCode?: string }[] }>("/api/employees?pageSize=1000")
      .then((r) => {
        setError(null);
        setEmployees(r.items);
        setIncludeById((prev) => {
          const next: Record<string, boolean> = {};
          for (const e of r.items) next[e.id] = prev[e.id] ?? true;
          return next;
        });
      })
      .catch(() => setError("Could not load employees."))
      .finally(() => setEmpLoading(false));
  }, []);

  useEffect(() => {
    setBalanceLoading(true);
    apiFetch<BalanceSummary[]>(`/api/leave/balances/summary?year=${fromYear}`)
      .then((rows) => {
        const m: Record<string, number> = {};
        for (const s of rows) {
          m[s.employeeId] = s.balances.reduce((sum, b) => sum + (b.remaining ?? 0), 0);
        }
        setAvailableByEmployeeId(m);
      })
      .catch(() => setAvailableByEmployeeId({}))
      .finally(() => setBalanceLoading(false));
  }, [fromYear]);

  const allSelected = useMemo(
    () => employees.length > 0 && employees.every((e) => includeById[e.id]),
    [employees, includeById]
  );
  const someSelected = useMemo(
    () => employees.some((e) => includeById[e.id]),
    [employees, includeById]
  );

  useEffect(() => {
    const el = headerIncludeRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function setAllIncluded(checked: boolean) {
    setIncludeById((prev) => {
      const next = { ...prev };
      for (const e of employees) next[e.id] = checked;
      return next;
    });
  }

  const totalAvailableListed = useMemo(
    () => employees.reduce((sum, e) => sum + (availableByEmployeeId[e.id] ?? 0), 0),
    [employees, availableByEmployeeId]
  );

  function fmtDays(n: number) {
    if (n === 0) return "0";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  const employeesPager = useClientPagination(employees, 20);

  async function handleRun() {
    if (toYear !== fromYear + 1) {
      setError("To year must be the year after From year (e.g. 2025 → 2026).");
      return;
    }
    const employeeIds = employees.filter((e) => includeById[e.id]).map((e) => e.id);
    if (employeeIds.length === 0) {
      setError("Select at least one employee. Unchecked employees are excluded from carry forward.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<CarryForwardResult>("/api/leave/process-carry-forward", {
        method: "POST",
        body: JSON.stringify({ fromYear, toYear, employeeIds }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Carry forward failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-slate-800">Leave Carry Forward</h2>
        <p className="mb-4 text-sm text-slate-600">
          Run this at the start of a new year to move unused leave from the <strong>source</strong> year into the <strong>target</strong> year.
          Only leave types with <strong>Allow carry forward</strong> in Policies are processed; days are capped by each policy&apos;s{" "}
          <strong>Max carry forward days</strong>. Use the table to include or exclude employees—unchecked employees are not carried forward.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>From year (source)</label>
            <FormSelect
              value={String(fromYear)}
              onValueChange={(v) => setFromYear(Number(v))}
              options={fromYearOptions}
              className="w-32"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>To year (target)</label>
            <FormSelect
              value={String(toYear)}
              onValueChange={(v) => setToYear(Number(v))}
              options={toYearOptions}
              className="w-32"
              clearable={false}
            />
          </div>
          <Button onClick={handleRun} disabled={running || toYear !== fromYear + 1 || empLoading}>
            {running ? "Processing…" : "Run Carry Forward"}
          </Button>
        </div>
        {toYear !== fromYear + 1 && (
          <p className="mb-4 text-sm text-amber-600">To year must be exactly one year after From year.</p>
        )}

        {!empLoading && employees.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50/90 to-sky-50/30 px-4 py-3 sm:px-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Source year — available leave (preview)</p>
            <p className="mt-1 text-sm text-slate-700">
              Total <span className="font-semibold">remaining</span> days in <span className="font-semibold">{fromYear}</span> (all leave types, after usage), across everyone in the list:{" "}
              {balanceLoading ? (
                <span className="inline-block h-4 w-8 animate-pulse rounded bg-slate-200 align-middle" />
              ) : (
                <span className="text-lg font-semibold tabular-nums text-emerald-800">{fmtDays(totalAvailableListed)}</span>
              )}
              <span className="text-slate-500"> days</span>
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50/30 to-sky-50/20 px-5 py-4 sm:px-6">
            <h3 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Carry forward selection — {fromYear} → {toYear}</h3>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Checked = include. <span className="font-medium text-slate-600">Available</span> = total days remaining in {fromYear} (Leave Balances, all types).
            </p>
          </div>
          <div className="max-h-[min(55vh,32rem)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th
                    className="sticky top-0 z-10 w-12 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 backdrop-blur"
                    scope="col"
                  >
                    <span className="sr-only">Include</span>
                    <input
                      ref={headerIncludeRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => setAllIncluded(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                      title="Select or clear all"
                    />
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[8rem] border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur sm:pl-5"
                    scope="col"
                  >
                    Employee
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[5.5rem] border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                    scope="col"
                  >
                    ID
                  </th>
                  <th
                    className="sticky top-0 z-10 min-w-[7rem] border-b-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-slate-100/95 px-2 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-800 backdrop-blur sm:pr-3"
                    scope="col"
                  >
                    Available
                  </th>
                </tr>
              </thead>
              <tbody>
                {empLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="inline-flex items-center gap-2 text-slate-500">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                        <span>Loading…</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!empLoading &&
                  employeesPager.pageItems.map((e) => {
                    const n = availableByEmployeeId[e.id] ?? 0;
                    const remClass = n > 0 ? "text-emerald-800" : n < 0 ? "text-rose-700" : "text-slate-500";
                    return (
                      <tr key={e.id} className="group border-b border-slate-100/90 transition hover:bg-sky-50/35">
                        <td className="px-2 py-2.5 align-middle">
                          <input
                            type="checkbox"
                            checked={includeById[e.id] !== false}
                            onChange={(ev) =>
                              setIncludeById((prev) => ({ ...prev, [e.id]: ev.target.checked }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                          />
                        </td>
                        <td className="border-l-4 border-sky-400/45 bg-slate-50/25 py-2.5 pl-2 pr-2 text-slate-800 transition group-hover:border-sky-500/60 sm:pl-3">
                          {e.firstName} {e.lastName}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-slate-500 sm:px-3">
                          {e.employeeCode ?? "—"}
                        </td>
                        <td
                          className="min-w-[5.5rem] border-l-2 border-emerald-200/50 bg-gradient-to-l from-emerald-50/40 to-transparent py-2.5 pr-2 text-right sm:pl-1 sm:pr-3"
                        >
                          {balanceLoading ? (
                            <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200" />
                          ) : (
                            <span className={`text-base font-semibold tabular-nums ${remClass}`}>{fmtDays(n)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {!empLoading && employees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500">No employees found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={employeesPager.page} totalPages={employeesPager.totalPages} totalCount={employeesPager.totalCount} pageSize={employeesPager.pageSize} onPageChange={employeesPager.setPage} />
        </div>

        <FormErrorAlert message={error} onDismiss={() => setError(null)} className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" />
        {result && (
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Carry forward completed.</p>
              <p className="mt-1">
                Source balance rows considered: {result.balancesProcessed}. New balances created: {result.balancesCreated}. Balances
                updated: {result.balancesUpdated}. Total days carried: {result.totalDaysCarried}.
              </p>
          </div>
            {result.infoMessage && (
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">{result.infoMessage}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4a – Leave Types Tab
// ═══════════════════════════════════════════════════════════════

function LeaveTypesTab() {
  const [items, setItems] = useState<LeaveTypeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { apiFetch<LeaveTypeItem[]>("/api/leave/types").then(setItems); }, []);
  useEffect(() => { load(); }, [load]);
  const itemsPager = useClientPagination(items);

  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(item: LeaveTypeItem) { setEditing(item); setShowModal(true); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      description: fd.get("description") as string || null,
      defaultDaysPerYear: Number(fd.get("defaultDaysPerYear")),
      isPaid: fd.get("isPaid") === "on",
      isActive: fd.get("isActive") === "on",
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/types/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/types", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this leave type?", "Delete Leave Type"))) return;
    await apiFetch(`/api/leave/types/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openAdd}>+ Add Leave Type</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
        <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50/30 to-sky-50/20 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Leave Types</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Catalog of leave categories, default entitlements, and status.</p>
        </div>
        <div className="max-h-[min(70vh,48rem)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  className="sticky top-0 z-10 min-w-[9rem] border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur sm:pl-5"
                  scope="col"
                >
                  Name
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[5rem] border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Code
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[5.5rem] border-b-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-slate-100/95 px-2 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-emerald-800 backdrop-blur sm:pr-2"
                  scope="col"
                >
                  Days / year
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Paid
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Status
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[9.5rem] border-b border-slate-200/90 bg-slate-100/95 py-3 pl-1 pr-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur sm:pr-3"
                  scope="col"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-sm text-slate-500">No leave types defined yet.</p>
                    <p className="mt-1 text-xs text-slate-400">Create a type to use it in policies and balances.</p>
                  </td>
                </tr>
              )}
              {itemsPager.pageItems.map((t) => (
                <tr key={t.id} className="group border-b border-slate-100/90 transition hover:bg-sky-50/35">
                  <td className="border-l-4 border-sky-400/45 bg-slate-50/25 py-2.5 pl-2 pr-2 text-slate-800 transition group-hover:border-sky-500/60 sm:pl-3 sm:pr-2">
                    <span className="font-medium">{t.name}</span>
                    {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{t.description}</p>}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    <span className="inline-flex max-w-full rounded-lg bg-slate-100/80 px-2.5 py-0.5 font-mono text-xs font-medium text-slate-700">
                      {t.code}
                    </span>
                  </td>
                  <td className="min-w-[5.5rem] border-l-2 border-emerald-200/50 bg-gradient-to-l from-emerald-50/40 to-transparent py-2.5 pr-2 text-right sm:pl-1 sm:pr-3">
                    <span className="text-base font-semibold tabular-nums text-emerald-800">{t.defaultDaysPerYear}</span>
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {t.isPaid ? <span className="text-sm font-medium text-emerald-700">Yes</span> : <span className="text-slate-400">No</span>}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {t.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Active</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-1 pr-1 text-right sm:pr-2">
                    <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-2.5 py-1 text-xs font-medium text-rose-800 transition hover:bg-rose-100/80"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={itemsPager.page} totalPages={itemsPager.totalPages} totalCount={itemsPager.totalCount} pageSize={itemsPager.pageSize} onPageChange={itemsPager.setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Leave Type" : "Add Leave Type"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Code *</label><input name="code" required defaultValue={editing?.code ?? ""} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={labelClass}>Days/Year *</label><input name="defaultDaysPerYear" type="number" required defaultValue={editing?.defaultDaysPerYear ?? 14} className={inputClass} /></div>
            <div className="flex items-center gap-2 pt-5"><input name="isPaid" type="checkbox" defaultChecked={editing?.isPaid ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Paid Leave</label></div>
            <div className="flex items-center gap-2 pt-5"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Active</label></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4b – Policies Tab
// ═══════════════════════════════════════════════════════════════

/** Shared gear icon (matches Annual / Casual / Sick entitlement rows). */
const ENTITLEMENT_RULE_GEAR_ICON = (
  <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function EntitlementRuleRowHeader({
  title,
  ruleType,
  inactive,
  rightSlot,
  className = "",
}: {
  title: string;
  ruleType: string;
  inactive?: boolean;
  rightSlot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex min-w-0 items-start justify-between gap-3 ${className}`.trim()}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">{ENTITLEMENT_RULE_GEAR_ICON}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          <p className="text-xs text-slate-400">
            Rule type: {ruleType} {inactive ? <span className="text-red-400">(Inactive)</span> : null}
          </p>
        </div>
      </div>
      {rightSlot ? <div className="shrink-0 pt-0.5">{rightSlot}</div> : null}
    </div>
  );
}

const DEFAULT_SICK_NARRATIVE = {
  intro: "Sri Lanka Shop & Office Act — sick leave (medical absences); days follow the Sick leave type and your Leave policies and contract.",
  points: [
    "Entitlement: up to 14 days on full pay per calendar year for certified illness, unless your contract or company policy states a different cap.",
    "Medical evidence: a registered medical practitioner's certificate is usually required for the absence, and for longer or repeated absences as required by company policy.",
    "Calendar year: sick leave is tracked in the calendar year (or the period on the employee's leave balance, if your setup uses a custom period).",
    "Separate from annual leave — for illness or injury; approvals and limits are configured under Leave policies for the Sick leave type.",
  ],
} as const;

function parseSickNarrativeFromRuleConfig(ruleConfig: string): { intro: string; points: string[]; sickEntitlementDays: number } {
  try {
    const o = JSON.parse(ruleConfig) as { narrative?: { intro?: string; points?: string[] }; sickEntitlementDays?: number };
    const p0 = o.narrative?.points;
    const points: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (p0 && p0[i] && String(p0[i]).trim()) points.push(String(p0[i]).trim());
      else points.push(DEFAULT_SICK_NARRATIVE.points[i] ?? "");
    }
    const intro = (o.narrative?.intro && o.narrative.intro.trim()) ? o.narrative.intro.trim() : DEFAULT_SICK_NARRATIVE.intro;
    const se = o.sickEntitlementDays;
    return {
      intro,
      points,
      sickEntitlementDays: typeof se === "number" && se >= 0 && se <= 366 ? se : 14,
    };
  } catch {
    return {
      intro: DEFAULT_SICK_NARRATIVE.intro,
      points: [...DEFAULT_SICK_NARRATIVE.points],
      sickEntitlementDays: 14,
    };
  }
}

function mergeSickEntitlementRuleConfigJson(existing: string, next: { intro: string; points: string[]; sickEntitlementDays: number }): string {
  let base: Record<string, unknown> = {};
  try {
    base = (JSON.parse(existing || "{}") as Record<string, unknown>) ?? {};
  } catch {
    /* ignore */
  }
  base.narrative = { intro: next.intro, points: next.points.map((x) => x.trim()) };
  base.sickEntitlementDays = next.sickEntitlementDays;
  return JSON.stringify(base);
}

function parseSickEntitlementDaysInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n < 0 || n > 366) return null;
  return n;
}

function ShopOfficeSickNarrativeView({ intro, points }: { intro: string; points: string[] }) {
  return (
    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
      <p className="whitespace-pre-wrap text-slate-800">{intro}</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {points.slice(0, 4).map((p, i) => (
          <li key={i} className="whitespace-pre-wrap">
            <span className="font-medium text-slate-700">{i + 1}.</span> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CarryForwardNarrativeView({ intro, points, windowDescription }: { intro: string; points: [string, string, string]; windowDescription: string }) {
  return (
    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
      <p className="whitespace-pre-wrap text-slate-800">{intro}</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {points.map((p, i) => (
          <li key={i} className="whitespace-pre-wrap">
            <span className="font-medium text-slate-700">{i + 1}.</span> {p}
          </li>
        ))}
      </ul>
      <p className="rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-700">System (Apply Leave): </span>
        {windowDescription}
      </p>
    </div>
  );
}

function SickNarrativeAdminBlock({
  mode,
  rule,
  sickLeaveTypeId,
  onUpdated,
  entitlementHeader,
  referenceHelperText,
}: {
  mode: "rule" | "reference";
  rule: EntitlementRule | null;
  sickLeaveTypeId: string | null;
  onUpdated: () => void | Promise<void>;
  entitlementHeader: { title: string; ruleType: string; inactive?: boolean };
  referenceHelperText?: string;
}) {
  const initial = useMemo(
    () => (rule ? parseSickNarrativeFromRuleConfig(rule.ruleConfig) : parseSickNarrativeFromRuleConfig("{}")),
    [rule?.id, rule?.ruleConfig, mode],
  );
  const [editing, setEditing] = useState(false);
  const [intro, setIntro] = useState(initial.intro);
  const [points, setPoints] = useState<string[]>(() => [...initial.points]);
  const [sickDaysInput, setSickDaysInput] = useState(String(initial.sickEntitlementDays));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = rule ? parseSickNarrativeFromRuleConfig(rule.ruleConfig) : parseSickNarrativeFromRuleConfig("{}");
    if (!editing) {
      setIntro(p.intro);
      setPoints([...p.points]);
      setSickDaysInput(String(p.sickEntitlementDays));
    }
  }, [rule?.id, rule?.ruleConfig, mode, editing]);

  async function save() {
    setErr(null);
    const sickEntitlementDays = parseSickEntitlementDaysInput(sickDaysInput);
    if (sickEntitlementDays === null) {
      setErr("Enter sick entitlement days as a whole number from 0 to 366.");
      return;
    }
    setSaving(true);
    try {
      const next = { intro, points, sickEntitlementDays };
      const config = mergeSickEntitlementRuleConfigJson(rule?.ruleConfig ?? "{}", next);
      if (mode === "rule" && rule) {
        await apiFetch<{ ruleConfig: string }>(`/api/leave/entitlement-rules/${rule.id}`, { method: "PUT", body: JSON.stringify({ ruleConfig: config }) });
      } else {
        if (!sickLeaveTypeId) {
          setErr("Sick leave type (code LT-SIC) not found. Add it under Leave Types first.");
          return;
        }
        await apiFetch("/api/leave/entitlement-rules", {
          method: "POST",
          body: JSON.stringify({ leaveTypeId: sickLeaveTypeId, ruleType: "ShopOfficeSick", ruleConfig: config }),
        });
      }
      setEditing(false);
      try {
        await Promise.resolve(onUpdated());
      } catch {
        /* Saved on server; refresh failed. */
      }
    } catch {
      setErr("Save failed. Check you have access to update entitlement rules.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    const p = rule ? parseSickNarrativeFromRuleConfig(rule.ruleConfig) : parseSickNarrativeFromRuleConfig("{}");
    setIntro(p.intro);
    setPoints([...p.points]);
    setSickDaysInput(String(p.sickEntitlementDays));
    setEditing(false);
    setErr(null);
  }

  return (
    <div className="ml-0 space-y-2">
      <EntitlementRuleRowHeader
        title={entitlementHeader.title}
        ruleType={entitlementHeader.ruleType}
        inactive={entitlementHeader.inactive}
        rightSlot={!editing
          ? (
            <Button variant="secondary" className="text-xs" type="button" onClick={() => { setErr(null); setEditing(true); }}>
              Edit
            </Button>
            )
          : null}
      />
      {referenceHelperText ? <p className="mb-2 text-xs text-slate-500">{referenceHelperText}</p> : null}
      {editing ? (
        <div className="ml-11 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700">
          <FormErrorAlert message={err} onDismiss={() => setErr(null)} className="text-xs text-red-600" />
          <div>
            <label className={labelClass}>Intro / lead line</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} className={inputClass} rows={2} />
          </div>
          {([0, 1, 2, 3] as const).map((i) => (
            <div key={i}>
              <label className={labelClass}>Point {i + 1}</label>
              <textarea value={points[i] ?? ""} onChange={(e) => {
                const c = [...points];
                c[i] = e.target.value;
                setPoints(c);
              }} className={inputClass} rows={2} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Sick entitlement days / year (used for balance accrual)</label>
            <input
              type="text"
              inputMode="numeric"
              value={sickDaysInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) setSickDaysInput(v);
              }}
              placeholder="e.g. 14"
              className={`${inputClass} max-w-[8rem]`}
              aria-label="Sick entitlement days per year"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => { void save(); }} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <ShopOfficeSickNarrativeView intro={intro} points={points} />
      )}
    </div>
  );
}

function CarryForwardNarrativeAdminBlock({
  settings,
  onUpdated,
  canEdit,
}: {
  settings: CarryForwardAvailability;
  onUpdated: () => void | Promise<void>;
  /** Users who may change carry-forward text/months (aligned with API: Leave update All, or Supervisor). */
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [availabilityMonths, setAvailabilityMonths] = useState(() => settings.availabilityMonths ?? 3);
  const [intro, setIntro] = useState(
    () => (settings.narrativeIntro && settings.narrativeIntro.trim() ? settings.narrativeIntro : DEFAULT_CARRY_NARRATIVE.intro),
  );
  const [points, setPoints] = useState<[string, string, string]>(() => carryNarrativePointsTuple(settings.narrativePoints));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setAvailabilityMonths(settings.availabilityMonths ?? 3);
      setIntro(
        (settings.narrativeIntro && settings.narrativeIntro.trim() ? settings.narrativeIntro : DEFAULT_CARRY_NARRATIVE.intro),
      );
      setPoints(carryNarrativePointsTuple(settings.narrativePoints));
    }
  }, [settings, editing]);

  useEffect(() => {
    if (!canEdit && editing) {
      setEditing(false);
      setErr(null);
    }
  }, [canEdit, editing]);

  async function save() {
    setErr(null);
    setSaveOk(null);
    setSaving(true);
    try {
      await apiFetch<CarryForwardAvailability>("/api/leave/carry-forward-availability", {
        method: "PUT",
        body: JSON.stringify({
          availabilityMonths,
          narrativeIntro: intro,
          narrativePoints: points,
        }),
      });
      setEditing(false);
      setSaveOk("Updated successfully.");
      try {
        await Promise.resolve(onUpdated());
      } catch {
        /* Saved on server; refresh failed (e.g. network). Values still apply after reload. */
      }
    } catch (e) {
      setErr(carryForwardSaveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ml-0 space-y-2">
      <EntitlementRuleRowHeader
        title="Carry forward (unused days)"
        ruleType="Balance carry — not a leave type"
        rightSlot={canEdit && !editing
          ? <Button variant="secondary" className="text-xs" type="button" onClick={() => { setErr(null); setSaveOk(null); setEditing(true); }}>Edit</Button>
          : null}
      />
      {editing ? (
        <div className="ml-11 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700">
          <FormErrorAlert message={err} onDismiss={() => setErr(null)} className="text-xs text-red-600" />
          <div>
            <label className={labelClass}>Valid months to use carry-forward (start of each balance period, default 3)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={availabilityMonths}
              onChange={(e) => setAvailabilityMonths(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              className={`${inputClass} max-w-[8rem]`}
            />
            <p className="mt-0.5 text-[11px] text-slate-500">
              This value is enforced when employees apply for leave. Unused carry is removed from the usable pool after the window; balances refresh when the list is loaded. Stored in system settings.
            </p>
          </div>
          <div>
            <label className={labelClass}>Intro (lead line)</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} className={inputClass} rows={2} />
          </div>
          {([0, 1, 2] as const).map((i) => (
            <div key={i}>
              <label className={labelClass}>Point {i + 1}</label>
              <textarea
                value={points[i] ?? ""}
                onChange={(e) => {
                  const c: [string, string, string] = [...points] as [string, string, string];
                  c[i] = e.target.value;
                  setPoints(c);
                }}
                className={inputClass}
                rows={2}
              />
            </div>
          ))}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setAvailabilityMonths(settings.availabilityMonths ?? 3);
                setIntro(
                  (settings.narrativeIntro && settings.narrativeIntro.trim() ? settings.narrativeIntro : DEFAULT_CARRY_NARRATIVE.intro),
                );
                setPoints(carryNarrativePointsTuple(settings.narrativePoints));
                setEditing(false);
                setErr(null);
                setSaveOk(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => { void save(); }} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <div className="ml-0 space-y-2">
          {!canEdit ? (
            <p className="ml-11 text-[11px] text-slate-500">
              Only accounts with organization-wide <strong className="font-medium text-slate-600">Leave</strong> update access (e.g. HR / Admin) or the{" "}
              <strong className="font-medium text-slate-600">Supervisor</strong> role can edit valid months and this reference text.
            </p>
          ) : null}
          {saveOk ? (
            <InlinePageAlert message={saveOk} variant="success" className="ml-11 text-[12px] font-medium text-emerald-700 scroll-mt-20" />
          ) : null}
          <CarryForwardNarrativeView
            intro={settings.narrativeIntro && settings.narrativeIntro.trim() ? settings.narrativeIntro : DEFAULT_CARRY_NARRATIVE.intro}
            points={carryNarrativePointsTuple(settings.narrativePoints)}
            windowDescription={settings.windowDescription?.trim() || buildCarryWindowDescription(settings.availabilityMonths ?? 3)}
          />
        </div>
      )}
    </div>
  );
}

const ENTITLEMENT_RULE_SORT_ORDER: Record<string, number> = {
  ShopOfficeAnnual: 0,
  ShopOfficeCasual: 1,
  ShopOfficeSick: 2,
};

function sortEntitlementRulesForDisplay(rules: EntitlementRule[]) {
  return [...rules].sort((a, b) => {
    const oa = ENTITLEMENT_RULE_SORT_ORDER[a.ruleType] ?? 50;
    const ob = ENTITLEMENT_RULE_SORT_ORDER[b.ruleType] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.leaveTypeName.localeCompare(b.leaveTypeName);
  });
}

function parsePolicyDescription(desc: string | null): { intro: string; points: string[] } {
  if (!desc?.trim()) return { intro: "", points: [""] };
  try {
    const o = JSON.parse(desc) as { intro?: string; points?: string[] };
    if (typeof o === "object" && o !== null && (o.intro !== undefined || Array.isArray(o.points))) {
      const raw = (o.points ?? []).map((p) => String(p ?? ""));
      const points = raw.length > 0 ? raw : [""];
      return { intro: String(o.intro ?? "").trim(), points };
    }
  } catch {
    /* legacy plain-text description */
  }
  return { intro: desc.trim(), points: [""] };
}

function buildPolicyDescription(intro: string, points: string[]): string | null {
  const trimmedIntro = intro.trim();
  const trimmedPoints = points.map((p) => p.trim()).filter(Boolean);
  if (!trimmedIntro && trimmedPoints.length === 0) return null;
  return JSON.stringify({ intro: trimmedIntro, points: trimmedPoints });
}

function policyDescriptionPreview(desc: string | null): string {
  const { intro, points } = parsePolicyDescription(desc);
  const bullets = points.filter(Boolean);
  if (intro && bullets.length > 0) return `${intro} · ${bullets.length} pointer${bullets.length === 1 ? "" : "s"}`;
  if (intro) return intro;
  if (bullets.length > 0) return bullets[0];
  return "";
}

function PoliciesTab() {
  const { hasRole, user, isAdmin } = useAuth();
  const canEditCarryForwardSettings =
    isAdmin ||
    hasRole("HR_MANAGER") ||
    hasRole("SUPERVISOR") ||
    (user?.permissions.some(
      (p) => p.module === "Leave" && p.action === "Update" && (p.scope ?? "Own") === "All",
    ) ?? false);
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [policyIntro, setPolicyIntro] = useState("");
  const [policyPoints, setPolicyPoints] = useState<string[]>([""]);
  const [rules, setRules] = useState<EntitlementRule[]>([]);
  const [carrySettings, setCarrySettings] = useState<CarryForwardAvailability | null>(null);

  const sortedRules = useMemo(() => sortEntitlementRulesForDisplay(rules), [rules]);
  const hasShopOfficeSickRule = useMemo(() => rules.some((r) => r.ruleType === "ShopOfficeSick"), [rules]);
  const sickCatalogLeaveTypeId = useMemo(
    () => leaveTypes.find((lt) => lt.code === "LT-SIC")?.id ?? null,
    [leaveTypes],
  );

  const load = useCallback(() => {
    return Promise.all([
      apiFetch<PolicyItem[]>("/api/leave/policies"),
      apiFetch<LeaveTypeItem[]>("/api/leave/types"),
      apiFetch<EntitlementRule[]>("/api/leave/entitlement-rules").catch(() => [] as EntitlementRule[]),
      apiFetch<unknown>("/api/leave/carry-forward-availability").catch(() => ({ availabilityMonths: 3 })),
    ]).then(([p, t, r, rawCf]) => {
      setItems(p);
      setLeaveTypes(t);
      setRules(r);
      setCarrySettings(normalizeCarrySettingsFromApi(rawCf));
    });
  }, []);
  useEffect(() => { load(); }, [load]);
  const policiesPager = useClientPagination(items);

  function openAdd() {
    setEditing(null);
    setPolicyIntro("");
    setPolicyPoints([""]);
    setShowModal(true);
  }

  function openEdit(item: PolicyItem) {
    const parsed = parsePolicyDescription(item.description);
    setEditing(item);
    setPolicyIntro(parsed.intro);
    setPolicyPoints(parsed.points.length > 0 ? parsed.points : [""]);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      description: buildPolicyDescription(policyIntro, [...policyPoints]),
      maxDaysPerYear: Number(fd.get("maxDaysPerYear")),
      allowCarryForward: fd.get("allowCarryForward") === "on",
      maxCarryForwardDays: Number(fd.get("maxCarryForwardDays") || 0),
      allowEncashment: fd.get("allowEncashment") === "on",
      requiresApproval: fd.get("requiresApproval") === "on",
      leaveTypeId: fd.get("leaveTypeId") as string,
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/policies/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/policies", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this policy?", "Delete Policy"))) return;
    await apiFetch(`/api/leave/policies/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openAdd}>+ Add Policy</Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader title="Leave Policies" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Policy Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Leave Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Max Days</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Carry Fwd</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Encashment</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Approval</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No policies defined.</td></tr>}
              {policiesPager.pageItems.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-700">{p.name}</p>
                    {policyDescriptionPreview(p.description) ? (
                      <p className="text-xs text-slate-400">{policyDescriptionPreview(p.description)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.leaveTypeName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.maxDaysPerYear}</td>
                  <td className="px-4 py-3">{p.allowCarryForward ? <span className="text-green-600">Yes ({p.maxCarryForwardDays}d)</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{p.allowEncashment ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{p.requiresApproval ? <span className="text-amber-600">Required</span> : <span className="text-slate-400">Auto</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={policiesPager.page} totalPages={policiesPager.totalPages} totalCount={policiesPager.totalCount} pageSize={policiesPager.pageSize} onPageChange={policiesPager.setPage} />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Policy" : "Add Policy"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className={labelClass}>Policy Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Policy pointers</p>
            <div>
              <label className={labelClass}>Intro / lead line</label>
              <textarea value={policyIntro} onChange={(e) => setPolicyIntro(e.target.value)} className={inputClass} rows={2} placeholder="Short summary shown above the bullet points" />
            </div>
            {policyPoints.map((point, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={labelClass}>Point {i + 1}</label>
                  {policyPoints.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setPolicyPoints((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={point}
                  onChange={(e) => {
                    setPolicyPoints((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)));
                  }}
                  className={inputClass}
                  rows={2}
                  placeholder={`Policy pointer ${i + 1}`}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPolicyPoints((prev) => [...prev, ""])}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Add pointer
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Leave Type *</label>
              <select name="leaveTypeId" required defaultValue={editing?.leaveTypeId ?? ""} className={inputClass}>
                <option value="">Select...</option>
                {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Max Days/Year *</label><input name="maxDaysPerYear" type="number" required defaultValue={editing?.maxDaysPerYear ?? 14} className={inputClass} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2"><input name="allowCarryForward" type="checkbox" defaultChecked={editing?.allowCarryForward ?? false} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Allow Carry Forward</label></div>
            <div><label className={labelClass}>Max Carry Fwd Days</label><input name="maxCarryForwardDays" type="number" defaultValue={editing?.maxCarryForwardDays ?? 0} className={inputClass} /></div>
            <div className="flex items-center gap-2"><input name="allowEncashment" type="checkbox" defaultChecked={editing?.allowEncashment ?? false} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Allow Encashment</label></div>
          </div>
          <div className="flex items-center gap-2">
            <input name="requiresApproval" type="checkbox" defaultChecked={editing?.requiresApproval ?? true} className="h-4 w-4 rounded border-slate-300" />
            <label className="text-sm text-slate-600">Requires Approval</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Entitlement Rules + carry-forward reference */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Entitlement Rules" />
        <p className="border-b border-slate-100 px-6 pb-4 text-xs text-slate-500">
          Reference text for Shop &amp; Office–style rules linked to leave types. Your <strong className="font-medium text-slate-600">Leave policies</strong> and balances may add limits, approvals, and carry-forward caps.
        </p>
          <div className="divide-y divide-slate-100">
          {sortedRules.length > 0
            ? sortedRules.map((rule) => {
            if (rule.ruleType === "ShopOfficeSick") {
              return (
                <div key={rule.id} className="px-6 py-4">
                  <SickNarrativeAdminBlock
                    mode="rule"
                    rule={rule}
                    sickLeaveTypeId={sickCatalogLeaveTypeId}
                    onUpdated={load}
                    entitlementHeader={{ title: rule.leaveTypeName, ruleType: rule.ruleType, inactive: !rule.isActive }}
                  />
                </div>
              );
            }

              let config: EntitlementRuleConfigDisplay | null = null;
              try {
                config = JSON.parse(rule.ruleConfig) as EntitlementRuleConfigDisplay;
              } catch {
                /* ignore */
              }
              const monthLabel = (m: number) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1] ?? "";

              return (
                <div key={rule.id} className="px-6 py-4">
                <EntitlementRuleRowHeader
                  title={rule.leaveTypeName}
                  ruleType={rule.ruleType}
                  inactive={!rule.isActive}
                />

                  {rule.ruleType === "ShopOfficeAnnual" && (
                    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-800">Sri Lanka Shop &amp; Office Act</strong> — calendar year; annual leave uses employment type and confirmation dates.
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>
                          <span className="font-medium text-slate-700">1.</span> Joining calendar year: no annual leave. While on probation (employment type or before permanent date): no annual leave.
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">2.</span> Permanent for annual leave from Date of permanency, or the day after Probation end date, or from join if employment type is not probation (e.g. Full-Time Permanent).
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">3.</span> First eligible calendar year after join (and from permanent year): pro-rated by original join quarter — Jan–Mar 14d, Apr–Jun 10d, Jul–Sep 7d, Oct–Dec 4d
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">4.</span> Following calendar years: 14 days per year
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">5.</span> Usage: minimum 7 consecutive calendar days per application
                        </li>
                      </ul>
                    </div>
                  )}
                  {rule.ruleType === "ShopOfficeCasual" && (
                    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-800">Sri Lanka Shop &amp; Office Act</strong> — casual leave (max 7 days).
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>
                          <span className="font-medium text-slate-700">1.</span> Joining year: 0.5 day per completed calendar month from join (partial join month excluded), capped at 7
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">2.</span> From the next calendar year: 7 days per year
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* ServiceYearBased display */}
                  {config && rule.ruleType === "ServiceYearBased" && (
                    <div className="ml-11 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-20 rounded bg-slate-100 px-2 py-0.5 text-center text-[11px] font-semibold text-slate-500">Year 1</span>
                        <span className="text-xs text-slate-600">
                          {config.year1MonthlyRate
                            ? <>{config.year1MonthlyRate} day(s) per month <span className="text-slate-400">(each calendar month employed, through current month)</span></>
                            : config.year1Days === 0 ? "No leave (earned but not taken)" : `${config.year1Days} days`}
                        </span>
                      </div>
                      {config.monthlyAccrualEveryYear && config.year1MonthlyRate ? (
                        <p className="text-[11px] text-emerald-700">
                          Same monthly rate applies <strong>every calendar year</strong> (not a one‑time first-year rule). Year 2+ fixed days below are ignored while this is on.
                        </p>
                      ) : null}
                      {config.year2ProRata?.map((b: { joinMonthStart: number; joinMonthEnd: number; days: number }, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-block w-20 rounded bg-blue-100 px-2 py-0.5 text-center text-[11px] font-semibold text-blue-600">Year 2</span>
                          <span className="text-xs text-slate-600">
                            Joined {monthLabel(b.joinMonthStart)}–{monthLabel(b.joinMonthEnd)}: <strong className="text-slate-800">{b.days} days</strong> (pro-rata)
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-20 rounded px-2 py-0.5 text-center text-[11px] font-semibold ${config.year2ProRata?.length ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                          {config.year2ProRata?.length ? "Year 3+" : "Year 2+"}
                        </span>
                        <span className="text-xs text-slate-600"><strong className="text-slate-800">{config.year3PlusDays} days</strong> per year</span>
                      </div>
                    </div>
                  )}

                  {/* ChildOrderBased display */}
                  {config && rule.ruleType === "ChildOrderBased" && (
                    <div className="ml-11 space-y-1.5">
                      {config.applicableGender && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block w-24 rounded bg-purple-100 px-2 py-0.5 text-center text-[11px] font-semibold text-purple-600">Applies to</span>
                          <span className="text-xs text-slate-600">{config.applicableGender} employees only</span>
                        </div>
                      )}
                      {config.brackets?.map((b: { childFrom: number; childTo: number | null; days: number }, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-block w-24 rounded bg-pink-100 px-2 py-0.5 text-center text-[11px] font-semibold text-pink-600">
                            {b.childTo ? `Child ${b.childFrom}–${b.childTo}` : `Child ${b.childFrom}+`}
                          </span>
                          <span className="text-xs text-slate-600">
                            <strong className="text-slate-800">{b.days} days</strong> ({Math.floor(b.days / 7)} weeks)
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-400 mt-1">Default entitlement: {config.defaultDays} days (auto-calculated for 1st/2nd child; adjust manually for 3rd+ child)</p>
                    </div>
                  )}
                </div>
              );
            })
            : (
            <div className="px-6 py-4">
              <p className="text-sm text-slate-500">No entitlement rules are linked to leave types in the database yet. After seeding or admin setup, Annual, Casual, and Sick leave rules can appear here.</p>
          </div>
            )}

        {!hasShopOfficeSickRule && (
          <div className="px-6 py-4">
            <SickNarrativeAdminBlock
              mode="reference"
              rule={null}
              sickLeaveTypeId={sickCatalogLeaveTypeId}
              onUpdated={load}
              entitlementHeader={{ title: "Sick Leave", ruleType: "ShopOfficeSick (reference)" }}
              referenceHelperText="Shown when no ShopOfficeSick rule is present in the database yet. Save your text below to create the rule, or use seeding to add it from the server."
            />
        </div>
      )}

        <div className="px-6 py-4">
          {carrySettings
            ? (
              <CarryForwardNarrativeAdminBlock
                settings={carrySettings}
                onUpdated={load}
                canEdit={canEditCarryForwardSettings}
              />
            )
            : <p className="ml-2 text-xs text-slate-500 sm:ml-11">Loading carry-forward display settings…</p>}
        </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 5 – Holidays Tab
// ═══════════════════════════════════════════════════════════════

function HolidaysTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [locale, setLocale] = useState<HolidayLocaleSettings | null>(null);
  const [countryCode, setCountryCode] = useState("LK");
  const [timeZoneId, setTimeZoneId] = useState("Asia/Colombo");
  const [selectedKinds, setSelectedKinds] = useState<HolidayKind[]>(() => [...ALL_HOLIDAY_KINDS]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HolidayItem | null>(null);
  const [defaultDate, setDefaultDate] = useState("");
  const [holidayKind, setHolidayKind] = useState<HolidayKind>("Public");
  const [saving, setSaving] = useState(false);
  const [localeSaving, setLocaleSaving] = useState(false);

  const countryLabel = locale?.countries.find((c) => c.code === countryCode)?.label ?? countryCode;

  const loadLocale = useCallback(async () => {
    const data = await apiFetch<HolidayLocaleSettings>("/api/leave/holidays/locale");
    setLocale(data);
    setCountryCode(data.countryCode);
    setTimeZoneId(data.timeZoneId);
  }, []);

  const load = useCallback((targetCountry = countryCode) => {
    apiFetch<HolidayItem[]>(
      `/api/leave/holidays?year=${year}&country=${encodeURIComponent(targetCountry)}`,
    ).then(setItems);
  }, [year, countryCode]);

  useEffect(() => { loadLocale(); }, [loadLocale]);
  useEffect(() => { load(); }, [load]);

  const countryOptions = useMemo<FormSelectOption[]>(
    () => (locale?.countries ?? []).map((c) => ({ value: c.code, label: c.label })),
    [locale],
  );

  const timeZoneOptions = useMemo<FormSelectOption[]>(
    () => (locale?.timeZones ?? []).map((t) => ({ value: t.id, label: t.label })),
    [locale],
  );

  const filteredItems = useMemo(() => {
    if (selectedKinds.length === 0) return [];
    if (selectedKinds.length === ALL_HOLIDAY_KINDS.length) return items;
    const selected = new Set(selectedKinds);
    return items.filter((h) => selected.has(normalizeHolidayKind(h)));
  }, [items, selectedKinds]);

  const selectedKindsLabel = useMemo(() => {
    if (selectedKinds.length === 0) return "selected types";
    if (selectedKinds.length === ALL_HOLIDAY_KINDS.length) return "";
    return `${selectedKinds.map((k) => holidayKindLabel(k).toLowerCase()).join(", ")} `;
  }, [selectedKinds]);

  function toggleKindFilter(kind: HolidayKind) {
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
  }

  async function persistLocale(nextCountry: string, nextTimeZone: string) {
    setLocaleSaving(true);
    try {
      const data = await apiFetch<HolidayLocaleSettings>("/api/leave/holidays/locale", {
        method: "PUT",
        body: JSON.stringify({ countryCode: nextCountry, timeZoneId: nextTimeZone }),
      });
      setLocale(data);
      setCountryCode(data.countryCode);
      setTimeZoneId(data.timeZoneId);
      load(data.countryCode);
    } catch {
      /* ignore */
    } finally {
      setLocaleSaving(false);
    }
  }

  async function handleCountryChange(nextCountry: string) {
    const nextTimeZone = defaultTimeZoneForCountry(nextCountry, locale?.timeZones ?? []);
    setCountryCode(nextCountry);
    setTimeZoneId(nextTimeZone);
    await persistLocale(nextCountry, nextTimeZone);
  }

  async function handleTimeZoneChange(nextTimeZone: string) {
    setTimeZoneId(nextTimeZone);
    await persistLocale(countryCode, nextTimeZone);
  }

  function openAdd(isoDate = "") {
    setEditing(null);
    setDefaultDate(isoDate);
    setHolidayKind("Public");
    setShowModal(true);
  }

  function openEdit(item: HolidayItem) {
    setEditing(item);
    setDefaultDate("");
    setHolidayKind(normalizeHolidayKind(item));
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const dateVal = fd.get("date") as string;
    const payload = {
      name: fd.get("name") as string,
      date: dateVal,
      kind: holidayKind,
      isRestricted: holidayKind === "Restricted",
      description: fd.get("description") as string || null,
      year: new Date(dateVal).getFullYear(),
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/holidays/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/holidays", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this holiday?", "Delete Holiday"))) return;
    await apiFetch(`/api/leave/holidays/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-200/50 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>Country</label>
            <FormSelect
              value={countryCode}
              onValueChange={(v) => { void handleCountryChange(v); }}
              options={countryOptions}
              className="w-44"
              clearable={false}
              disabled={localeSaving || countryOptions.length === 0}
            />
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <FormSelect
              value={timeZoneId}
              onValueChange={(v) => { void handleTimeZoneChange(v); }}
              options={timeZoneOptions}
              className="min-w-[14rem]"
              clearable={false}
              disabled={localeSaving || timeZoneOptions.length === 0}
            />
          </div>
          <div>
            <label className={labelClass}>Year</label>
            <FormSelect
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              options={LEAVE_YEAR_FORM_OPTIONS}
              className="w-36"
              clearable={false}
            />
          </div>
          <div className="ml-auto">
            <Button onClick={() => openAdd()}>+ Add Holiday</Button>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={labelClass}>Show holidays</p>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedKinds([...ALL_HOLIDAY_KINDS])}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedKinds([])}
                className="font-medium text-slate-500 hover:text-slate-700"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {HOLIDAY_KINDS.map((kind) => (
              <label key={kind} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedKinds.includes(kind)}
                  onChange={() => toggleKindFilter(kind)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm text-slate-700">{holidayKindLabel(kind)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex h-[28rem] flex-col">
          <HolidaysCalendarPanel
            year={year}
            items={filteredItems}
            onSelectHoliday={openEdit}
            onAddForDate={openAdd}
          />
        </div>

        <div className="flex h-[28rem] flex-col">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
            <div className="shrink-0 border-b border-slate-100 bg-gradient-to-br from-white via-slate-50/30 to-sky-50/20 px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Company Holidays — {year}</h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                {countryLabel} calendar ({timeZoneId}).{" "}
                {countryCode === "LK"
                  ? "Statutory mercantile and Poya days (2024–2027) are added automatically."
                  : "National public holidays (2024–2027) are added automatically when you select this country."}
              </p>
            </div>
            <div className="opensky-table-scroll min-h-0 flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur sm:pl-5"
                  scope="col"
                >
                  Holiday
                </th>
                <th
                  className="sticky top-0 z-10 border-b-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-emerald-800 backdrop-blur sm:pl-2"
                  scope="col"
                >
                  Date
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Day
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Type
                </th>
                <th
                  className="sticky top-0 z-10 border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Note
                </th>
                <th
                  className="sticky top-0 z-10 w-28 border-b border-slate-200/90 bg-slate-100/95 py-3 pl-1 pr-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur sm:pr-3"
                  scope="col"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-sm text-slate-500">
                      {selectedKinds.length === 0
                        ? "Select at least one holiday type above to show dates."
                        : `No ${selectedKindsLabel}holidays for ${countryLabel} in ${year}.`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Change country, year, or holiday type filters above.</p>
                  </td>
                </tr>
              )}
              {filteredItems.map((h) => {
                const dayName = fmtHolidayWeekday(h.date, timeZoneId);
                const kind = normalizeHolidayKind(h);
                const styles = holidayKindStyles(kind);
                return (
                  <tr key={h.id} className="group border-b border-slate-100/90 transition hover:bg-sky-50/35">
                    <td className="border-l-4 border-sky-400/45 bg-slate-50/25 py-2.5 pl-2 pr-2 font-medium text-slate-800 transition group-hover:border-sky-500/60 sm:pl-3 sm:pr-2">
                      {h.name}
                    </td>
                    <td
                      className="border-l-2 border-emerald-200/50 bg-gradient-to-l from-emerald-50/40 to-transparent py-2.5 pl-2 pr-2 sm:pl-3 sm:pr-2"
                    >
                      <span className="font-semibold tabular-nums text-emerald-900">{fmtHolidayDateInZone(h.date, timeZoneId)}</span>
                    </td>
                    <td className="px-2 py-2.5 sm:px-3">
                      <span className="inline-flex rounded-lg bg-slate-100/80 px-2.5 py-0.5 text-xs font-medium text-slate-700">{dayName}</span>
                    </td>
                    <td className="px-2 py-2.5 sm:px-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}>{styles.label}</span>
                    </td>
                    <td className="max-w-[10rem] px-2 py-2.5 text-xs text-slate-600 sm:px-3">
                      <span className="line-clamp-2">{h.description?.trim() ? h.description : "—"}</span>
                    </td>
                    <td className="py-2.5 pl-1 pr-1 text-right sm:pr-2">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(h)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(h.id)}
                          className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-2.5 py-1 text-xs font-medium text-rose-800 transition hover:bg-rose-100/80"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </div>
        </div>
      </div>

      <HolidaysSummaryLists year={year} items={filteredItems} onSelectHoliday={openEdit} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Holiday" : "Add Holiday"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className={labelClass}>Holiday Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Date *</label>
              <DatePickerField
                key={editing?.id ?? `new-${defaultDate || "blank"}`}
                name="date"
                required
                defaultValue={editing ? editing.date.substring(0, 10) : defaultDate}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Holiday type *</label>
              <FormSelect
                value={holidayKind}
                onValueChange={(v) => setHolidayKind(v as HolidayKind)}
                options={HOLIDAY_KIND_OPTIONS}
                clearable={false}
              />
            </div>
          </div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 6 – Team Calendar Tab
// ═══════════════════════════════════════════════════════════════

function CalendarTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [countryCode, setCountryCode] = useState("LK");
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [departmentFilterId, setDepartmentFilterId] = useState("");

  const departmentFilterOptions = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments],
  );

  useEffect(() => {
    apiFetch<DepartmentLookup[]>("/api/organization/departments").then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    apiFetch<HolidayLocaleSettings>("/api/leave/holidays/locale")
      .then((locale) => setCountryCode(locale.countryCode))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const deptQuery = departmentFilterId ? `&departmentId=${encodeURIComponent(departmentFilterId)}` : "";
    Promise.all([
      apiFetch<CalendarDay[]>(`/api/leave/calendar?month=${month}&year=${year}${deptQuery}`),
      apiFetch<HolidayItem[]>(`/api/leave/holidays?year=${year}&country=${encodeURIComponent(countryCode)}`),
    ]).then(([cal, hol]) => {
      setDays(cal);
      setHolidays(hol.filter((h) => holidayMonthFromIso(h) === month));
    }).finally(() => setLoading(false));
  }, [month, year, countryCode, departmentFilterId]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const dayMap = new Map(days.map((d) => [new Date(d.date).getDate(), d]));
  const holidayMap = new Map(holidays.map((h) => [holidayDayFromIso(h), h]));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const typeColors: Record<string, string> = {
    "Annual Leave": "bg-blue-200 text-blue-800",
    "Casual Leave": "bg-teal-200 text-teal-800",
    "Sick Leave": "bg-red-200 text-red-800",
    "Maternity Leave": "bg-pink-200 text-pink-800",
    "No-Pay Leave": "bg-slate-200 text-slate-700",
  };

  return (
    <div className="space-y-5">
      {/* Month navigation + department filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <button onClick={prevMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
            <svg className="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>Prev
          </button>
          <h2 className="text-lg font-bold text-slate-800">{monthNames[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
            Next<svg className="h-4 w-4 inline ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <FormSelect
          value={departmentFilterId}
          onValueChange={setDepartmentFilterId}
          options={departmentFilterOptions}
          className="w-full sm:w-52"
          clearable={false}
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading calendar...</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {dayNames.map((dn) => (
              <div key={dn} className="py-2.5 text-center text-xs font-semibold text-slate-500">{dn}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
              const calDay = day ? dayMap.get(day) : null;
              const holiday = day ? holidayMap.get(day) : null;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 ${!day ? "bg-slate-50/50" : isWeekend ? "bg-slate-50/30" : ""}`}
                >
                  {day && (
                    <>
                      <div className={`mb-1 text-right text-xs font-medium ${isToday ? "rounded-full bg-blue-600 text-white w-6 h-6 flex items-center justify-center ml-auto" : "text-slate-500"}`}>
                        {day}
                      </div>
                      {holiday && (
                        <div className={`mb-0.5 rounded px-1 py-0.5 text-[10px] font-medium truncate ${holidayKindStyles(normalizeHolidayKind(holiday)).chip}`} title={holiday.name}>
                          {holiday.name}
                        </div>
                      )}
                      {calDay?.entries.map((entry, ei) => (
                        <div
                          key={ei}
                          className={`mb-0.5 rounded px-1 py-0.5 text-[10px] font-medium truncate ${typeColors[entry.leaveTypeName] ?? "bg-slate-200 text-slate-700"}`}
                          title={`${entry.employeeName} — ${entry.leaveTypeName}`}
                        >
                          {entry.employeeName.split(" ")[0]}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500">Legend:</span>
        {Object.entries(typeColors).map(([name, cls]) => (
          <span key={name} className={`rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}>{name}</span>
        ))}
        {HOLIDAY_KINDS.map((kind) => {
          const styles = holidayKindStyles(kind);
          return (
            <span key={kind} className={`rounded px-2 py-0.5 text-[10px] font-medium ${styles.legendChip}`}>{styles.label}</span>
          );
        })}
      </div>
    </div>
  );
}
