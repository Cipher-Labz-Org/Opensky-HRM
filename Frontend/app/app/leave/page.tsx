"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId, Fragment, type ComponentType, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, TablePagination, FlashMessageBanner, FormErrorAlert, InlinePageAlert, ToastPopup, TimePickerField, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL, resolveAssetUrl } from "@/config/constants";
import { formatDate } from "@/lib/date-utils";
import { formatLocalDateToIso, instantToLocalDateKey } from "@/lib/datePickerIso";
import {
  DonutMixChart,
  formatInt,
  HorizontalCompareBars,
  WeeklyActivityBars,
} from "@/lib/workspace-charts";
import {
  DashboardCardHeader,
  DashboardKpiGrid,
  DashboardPageHeader,
} from "@/components/dashboard/DashboardUi";
import { OPENSKY_THEME } from "@/lib/opensky-theme";
import { useAuth } from "@/contexts/auth-context";
import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { LeaveRequestsPanel } from "@/components/workforce/LeaveRequestsPanel";
import { ROUTES } from "@/config/routes";
import { sanitizeSearchInput } from "@/lib/input-validation";
import {
  addMinutesToTime24,
  clampShortLeaveHours,
  computeLeaveRemaining,
  computeLeaveTotalDays,
  DEFAULT_SHORT_LEAVE_HOURS,
  diffTime24Hours,
  formatLeaveDays,
  formatLeaveDurationLabel,
  isShortLeaveType,
  LEAVE_WORKDAY_HOURS,
  parseOptionalHours,
  shortLeaveHourChoices,
  type LeaveDurationKind,
  type HalfDayPeriod,
} from "@/lib/leave-duration";

const SHORT_LEAVE_DAY_START_HOUR = 6;
const SHORT_LEAVE_DAY_END_HOUR = 20;
const SHORT_LEAVE_DAY_END = `${String(SHORT_LEAVE_DAY_END_HOUR).padStart(2, "0")}:00`;

function shortLeaveEndFromDuration(start: string, hours: number): string {
  const end = addMinutesToTime24(start, Math.round(hours * 60));
  if (!end) return "";
  return end > SHORT_LEAVE_DAY_END ? SHORT_LEAVE_DAY_END : end;
}

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
  durationKind?: string | null;
  halfDayPeriod?: string | null;
  shortLeaveHours?: number | null;
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
  allowHalfDay?: boolean;
  allowShortLeave?: boolean;
  shortLeaveHours?: number;
  minHours?: number | null;
  maxHours?: number | null;
  minDays?: number | null;
  maxDays?: number | null;
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
  entries: { employeeName: string; profileImageUrl?: string | null; leaveTypeName: string; status: string }[];
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
  { key: "assignLeaveType", label: "Leave Assignment" },
  { key: "leaveTypes", label: "Leave Master" },
  { key: "policies", label: "Policies" },
  { key: "holidays", label: "Holidays" },
  { key: "carryForward", label: "Carry Forward" },
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

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
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
  const { getLeaveReadScope, user, hasRole, isAdmin, hasPermission } = useAuth();
  const canLeaveApprove =
    isAdmin ||
    hasPermission("Leave", "Update") ||
    hasPermission("Approvals", "Update") ||
    hasRole("SUPERVISOR");
  const leaveHrCanOverride =
    isAdmin ||
    hasRole("HR_MANAGER") ||
    (user?.permissions.some(
      (p) => (p.module === "Leave" || p.module === "Approvals") && p.action === "Update" && (p.scope ?? "Own") === "All",
    ) ?? false);
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
          showApprovalActions={canLeaveApprove}
          hrCanOverride={leaveHrCanOverride}
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
      keys.push(formatLocalDateToIso(d));
    }
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, 0);
    dash?.recentRequests?.forEach((r) => {
      const k = instantToLocalDateKey(r.createdAt);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return keys.map((key) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0,
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

  const quickLinks = useMemo(
    () => [
      { tab: "applyLeave" as PageTab, title: "Apply leave", sub: "Submit a new time-off request" },
      { tab: "requests" as PageTab, title: "Leave requests", sub: "View and track every request" },
      { tab: "balances" as PageTab, title: "Leave balances", sub: "Check entitlements and remaining days" },
      {
        tab: "holidays" as PageTab,
        title: "Holidays",
        sub: dash ? `${formatInt(dash.upcomingHolidays)} upcoming on the calendar` : "View the company holiday calendar",
      },
    ],
    [dash],
  );

  const T = OPENSKY_THEME;
  const hasRecentActivity = activityLast7Days.some((d) => d.count > 0);

  if (dashLoading) {
    return (
      <>
        <DashboardPageHeader
          eyebrow="Leave workspace"
          title="Overview"
          subtitle="Track requests, approvals, and team leave activity at a glance."
        />
        <DashboardKpiGrid
          loading
          items={[
            { label: "Total leave requests", value: "—", sub: "Loading…" },
            { label: "Pending approvals", value: "—", sub: "Loading…" },
            { label: "Approved this month", value: "—", sub: "Loading…" },
            { label: "Upcoming holidays", value: "—", sub: "Loading…" },
          ]}
        />
      </>
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
    <div className="min-w-0 w-full max-w-full overflow-x-hidden [&_.opensky-dashboard-card]:min-w-0 [&_.opensky-dashboard-card]:max-w-full">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title="Overview"
        subtitle="Track requests, approvals, and team leave activity at a glance."
        badge={
          <Button onClick={onApplyLeave} className="shrink-0">
            + Apply leave
          </Button>
        }
      />

      <DashboardKpiGrid items={kpis} />

      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Leave activity"
            subtitle="Last 7 days"
            iconBg={T.actionSoft}
            iconColor={T.action}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
            <WeeklyActivityBars data={activityLast7Days} />
            <p className="mt-2 text-[11px]" style={{ color: T.muted }}>
              {hasRecentActivity
                ? "Bars show how many leave requests were submitted each day."
                : "No leave requests were submitted in the last 7 days."}
            </p>
          </div>
        </div>

        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Recent leave by status"
            subtitle="By outcome"
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
            {leaveStatusBars.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: T.muted }}>
                  No leave requests yet.
                </p>
                <Button variant="secondary" className="mt-4" onClick={onApplyLeave}>
                  Create first request
                </Button>
              </div>
            ) : (
              <HorizontalCompareBars items={leaveStatusBars} />
            )}
          </div>
        </div>

        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Status mix"
            subtitle="Outcome share"
            iconBg={T.primaryLight}
            iconColor={T.navyMid}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
            {leaveStatusBars.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: T.muted }}>
                Status breakdown appears once requests are submitted.
              </p>
            ) : (
              <DonutMixChart values={leaveStatusBars} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="opensky-dashboard-card min-w-0 overflow-hidden !p-0">
          <DashboardCardHeader
            compact
            title="Quick actions"
            subtitle="Common tasks"
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
          />
          <div className="grid grid-cols-1 gap-3 px-4 pb-4 pt-1 sm:grid-cols-2 sm:px-5 sm:pb-5 sm:pt-2 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => onOpenTab(link.tab)}
                className="opensky-dashboard-quicklink opensky-dashboard-quicklink--compact group min-w-0 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold" style={{ color: T.navy }}>
                      {link.title}
                    </div>
                    <p className="truncate text-[11px]" style={{ color: T.muted }}>
                      {link.sub}
                    </p>
                  </div>
                  <span className="opensky-quicklink-chev shrink-0 text-xs" style={{ color: T.action }}>
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Apply Leave Tab
// ═══════════════════════════════════════════════════════════════

interface EmployeeLookup { id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }

interface DepartmentLookup { id: string; name: string }

function formatCoveragePersonLabel(emp: { firstName: string; lastName: string; employeeCode?: string }) {
  const name = `${emp.firstName} ${emp.lastName}`.trim() || "Employee";
  const code = emp.employeeCode?.trim();
  return code ? `${name} (${code})` : name;
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

function getApplyLeaveTypeMeta(t: LeaveTypeItem, balances: BalanceItem[]) {
  const balance = balances.find(
    (x) => (x.leaveTypeId && x.leaveTypeId === t.id) || x.leaveTypeName === t.name,
  );
  const isNoPayRow = t.code?.toUpperCase() === "LT-NPL";
  const isSickRow = t.code?.toUpperCase() === "LT-SIC";
  const isShortLeaveRow = isShortLeaveType(t);
  const rowDisabled = !isNoPayRow && !balance && !isSickRow && !isShortLeaveRow;
  return { balance, isNoPayRow, isSickRow, isShortLeaveRow, rowDisabled };
}

function pickDefaultLeaveTypeId(types: LeaveTypeItem[], balances: BalanceItem[]): string {
  for (const t of types) {
    const { balance, rowDisabled } = getApplyLeaveTypeMeta(t, balances);
    if (!rowDisabled && balance && balance.remaining > 0) return t.id;
  }
  for (const t of types) {
    const { rowDisabled } = getApplyLeaveTypeMeta(t, balances);
    if (!rowDisabled) return t.id;
  }
  return "";
}

const ANNUAL_LEAVE_CODE = "LT-ANN";

function ApplyLeaveTab({ isEmployeeView, currentEmployeeId }: { isEmployeeView: boolean; currentEmployeeId: string | null }) {
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [departmentFilterId, setDepartmentFilterId] = useState("");
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState(isEmployeeView && currentEmployeeId ? currentEmployeeId : "");
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [annualNoticeOpen, setAnnualNoticeOpen] = useState(false);
  const [durationKind, setDurationKind] = useState<LeaveDurationKind>("FullDay");
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>("Morning");
  const [shortLeaveStartTime, setShortLeaveStartTime] = useState("");
  const [shortLeaveEndTime, setShortLeaveEndTime] = useState("");
  const [appliedShortLeaveHours, setAppliedShortLeaveHours] = useState(DEFAULT_SHORT_LEAVE_HOURS);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [coveragePerson, setCoveragePerson] = useState("");
  const [coverageEmployeeId, setCoverageEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const [medicalDrag, setMedicalDrag] = useState(false);
  const medicalInputId = useId();
  const currentYear = new Date().getFullYear();

  function onApplyStartDateChange(iso: string) {
    setStartDate(iso);
    if (durationKind !== "FullDay") {
      setEndDate(iso);
      return;
    }
    if (iso && endDate && endDate < iso) setEndDate("");
  }

  function onApplyEndDateChange(iso: string) {
    setEndDate(iso);
  }

  const applyEndMinDate = startDate || undefined;
  const applyDatesInvalid = Boolean(startDate && endDate && endDate < startDate);

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

  function selectEmployee(emp: EmployeeLookup) {
    setSelectedEmpId(emp.id);
    setSelectedTypeId("");
    setMessage(null);
    setEmployees((prev) => (prev.some((e) => e.id === emp.id) ? prev : [...prev, emp]));
  }

  function clearSelectedEmployee() {
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
    setHalfDayPeriod("Morning");
    const t = leaveTypes.find((x) => x.id === selectedTypeId);
    setDurationKind(isShortLeaveType(t) ? "ShortLeave" : "FullDay");
    setShortLeaveStartTime("");
    setShortLeaveEndTime("");
    setAppliedShortLeaveHours(clampShortLeaveHours(t?.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS));
  }, [selectedTypeId, leaveTypes]);

  useEffect(() => {
    if (isEmployeeView && currentEmployeeId) setSelectedEmpId(currentEmployeeId);
  }, [isEmployeeView, currentEmployeeId]);

  useEffect(() => {
    apiFetch<LeaveTypeItem[]>("/api/leave/types")
      .then(setLeaveTypes)
      .catch(() => setLeaveTypes([]));
    if (!isEmployeeView) {
      apiFetch<DepartmentLookup[]>("/api/organization/departments")
        .then(setDepartments)
        .catch(() => setDepartments([]));
    }
  }, [isEmployeeView]);

  useEffect(() => {
    if (!isEmployeeView) return;
    if (!currentEmployeeId) {
      setEmployees([]);
      setEmployeesLoading(false);
      return;
    }
    setEmployeesLoading(true);
    apiFetch<{ id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }>(
      `/api/employees/${currentEmployeeId}`,
    )
      .then((e) =>
        setEmployees([
          {
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            profileImageUrl: e.profileImageUrl,
            employeeCode: e.employeeCode,
          },
        ]),
      )
      .catch(() => setEmployees([]))
      .finally(() => setEmployeesLoading(false));
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
    if (!selectedEmpId || loadingBal || selectedTypeId) return;
    const defaultId = pickDefaultLeaveTypeId(leaveTypesForApply, balances);
    if (defaultId) setSelectedTypeId(defaultId);
  }, [selectedEmpId, loadingBal, selectedTypeId, leaveTypesForApply, balances]);

  useEffect(() => {
    setCoveragePerson("");
    setCoverageEmployeeId("");
  }, [selectedEmpId]);

  const selectedLeaveType = leaveTypes.find((t) => t.id === selectedTypeId);
  const isShortLeaveSelected = isShortLeaveType(selectedLeaveType);
  const applySingleDayOnly = isShortLeaveSelected || durationKind !== "FullDay";
  const allowHalfDay = Boolean(selectedLeaveType?.allowHalfDay) && !isShortLeaveSelected;
  const typeShortLeaveHours = clampShortLeaveHours(selectedLeaveType?.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS);
  const shortLeaveMinHours =
    selectedLeaveType?.minHours != null && selectedLeaveType.minHours > 0
      ? clampShortLeaveHours(selectedLeaveType.minHours)
      : 1;
  const shortLeaveMaxHours =
    selectedLeaveType?.maxHours != null && selectedLeaveType.maxHours > 0
      ? clampShortLeaveHours(selectedLeaveType.maxHours)
      : typeShortLeaveHours;
  const shortLeaveHourOptions = useMemo(
    () => shortLeaveHourChoices(selectedLeaveType?.minHours, selectedLeaveType?.maxHours, typeShortLeaveHours),
    [selectedLeaveType?.minHours, selectedLeaveType?.maxHours, typeShortLeaveHours],
  );
  const shortLeaveFixedDuration = shortLeaveHourOptions.length <= 1;
  const shortLeaveDurationHours = shortLeaveHourOptions.includes(appliedShortLeaveHours)
    ? appliedShortLeaveHours
    : (shortLeaveHourOptions.includes(typeShortLeaveHours) ? typeShortLeaveHours : shortLeaveHourOptions[0] ?? typeShortLeaveHours);
  const shortLeaveEndMinTime =
    shortLeaveStartTime && shortLeaveMinHours > 0
      ? addMinutesToTime24(shortLeaveStartTime, Math.round(shortLeaveMinHours * 60)) ?? undefined
      : undefined;
  const shortLeaveEndMaxTime =
    shortLeaveStartTime && shortLeaveMaxHours > 0
      ? addMinutesToTime24(shortLeaveStartTime, Math.round(shortLeaveMaxHours * 60)) ?? undefined
      : undefined;
  const shortLeaveStartMaxTime =
    addMinutesToTime24(SHORT_LEAVE_DAY_END, -Math.round(shortLeaveDurationHours * 60)) ?? undefined;
  const effectiveShortLeaveHours = isShortLeaveSelected
    ? diffTime24Hours(shortLeaveStartTime, shortLeaveEndTime) ?? 0
    : typeShortLeaveHours;

  function applyShortLeaveWindow(start: string, hours: number) {
    if (!start) {
      setShortLeaveEndTime("");
      return;
    }
    setShortLeaveEndTime(shortLeaveEndFromDuration(start, hours));
  }

  function onShortLeaveStartTimeChange(time24: string) {
    setShortLeaveStartTime(time24);
    applyShortLeaveWindow(time24, shortLeaveDurationHours);
  }

  function onShortLeaveHoursChange(hours: number) {
    setAppliedShortLeaveHours(hours);
    applyShortLeaveWindow(shortLeaveStartTime, hours);
  }

  function onShortLeaveEndTimeChange(time24: string) {
    setShortLeaveEndTime(time24);
    const diff = diffTime24Hours(shortLeaveStartTime, time24);
    if (diff == null) return;
    const matched = shortLeaveHourOptions.find((h) => Math.abs(h - diff) < 1e-6);
    setAppliedShortLeaveHours(matched ?? clampShortLeaveHours(diff));
  }

  const shortLeaveTimesReady =
    !isShortLeaveSelected ||
    (Boolean(shortLeaveStartTime && shortLeaveEndTime) &&
      effectiveShortLeaveHours > 0 &&
      effectiveShortLeaveHours >= shortLeaveMinHours - 1e-6 &&
      effectiveShortLeaveHours <= shortLeaveMaxHours + 1e-6);
  const applyDatesReady = applySingleDayOnly
    ? Boolean(startDate) && shortLeaveTimesReady
    : Boolean(startDate && endDate && !applyDatesInvalid);

  const totalDays = computeLeaveTotalDays({
    durationKind,
    startDate,
    endDate,
    shortLeaveHours: effectiveShortLeaveHours,
  });
  const selectedBalance = selectedLeaveType
    ? balances.find(
        (b) =>
          (b.leaveTypeId && b.leaveTypeId === selectedLeaveType.id) || b.leaveTypeName === selectedLeaveType.name
      )
    : undefined;
  const isNoPayLeave = selectedLeaveType?.code?.toUpperCase() === "LT-NPL";
  const isSickLeave = selectedLeaveType?.code?.toUpperCase() === "LT-SIC";
  const isAnnualLeave = selectedLeaveType?.code?.toUpperCase() === ANNUAL_LEAVE_CODE;
  /** More than 2 calendar days of sick leave requires a medical certificate PDF. */
  const sickLeaveRequiresMedicalPdf = isSickLeave && totalDays > 2;
  /** Sick leave and Short Leave can be applied even when no balance row exists; all other paid types need an assigned balance. */
  const allowApplyWithoutAssignedBalance = isNoPayLeave || isSickLeave || isShortLeaveSelected;
  const missingBalance = Boolean(
    selectedLeaveType && !allowApplyWithoutAssignedBalance && !selectedBalance
  );
  const exceedsBalance =
    !isNoPayLeave && !isShortLeaveSelected && selectedBalance ? totalDays > selectedBalance.remaining : false;

  /** Remind the applicant of the 3-day notice period each time Annual Leave becomes the selected type. */
  const annualNoticeShown = useRef(false);
  useEffect(() => {
    if (!isAnnualLeave) {
      annualNoticeShown.current = false;
      return;
    }
    if (annualNoticeShown.current) return;
    annualNoticeShown.current = true;
    setAnnualNoticeOpen(true);
  }, [isAnnualLeave]);

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
    setDurationKind("FullDay");
    setHalfDayPeriod("Morning");
    setStartDate("");
    setEndDate("");
    setReason("");
    setCoveragePerson("");
    setCoverageEmployeeId("");
    setMedicalFile(null);
    setMedicalDrag(false);
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setMessage({ type: "err", text: "Comments are required." });
      return;
    }
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
        text: `Insufficient leave balance. Available: ${formatLeaveDays(selectedBalance.remaining)} days, requested: ${formatLeaveDays(totalDays)} days.`,
      });
      return;
    }
    const minHours = selectedLeaveType?.minHours != null && selectedLeaveType.minHours > 0 ? selectedLeaveType.minHours : null;
    const maxHours = selectedLeaveType?.maxHours != null && selectedLeaveType.maxHours > 0 ? selectedLeaveType.maxHours : null;
    if (isShortLeaveSelected) {
      if (!shortLeaveStartTime || !shortLeaveEndTime) {
        setMessage({ type: "err", text: "Select start and end times for short leave." });
        return;
      }
      if (effectiveShortLeaveHours <= 0) {
        setMessage({ type: "err", text: "End time must be after the start time." });
        return;
      }
      if (minHours != null && effectiveShortLeaveHours < minHours) {
        setMessage({ type: "err", text: `This leave type requires at least ${minHours} hour(s). Requested: ${effectiveShortLeaveHours}.` });
        return;
      }
      if (maxHours != null && effectiveShortLeaveHours > maxHours) {
        setMessage({ type: "err", text: `This leave type allows at most ${maxHours} hour(s) per request. Requested: ${effectiveShortLeaveHours}.` });
        return;
      }
    } else {
      const minDays = selectedLeaveType?.minDays != null && selectedLeaveType.minDays > 0 ? selectedLeaveType.minDays : null;
      const maxDays = selectedLeaveType?.maxDays != null && selectedLeaveType.maxDays > 0 ? selectedLeaveType.maxDays : null;
      if (minDays != null && totalDays < minDays) {
        setMessage({
          type: "err",
          text: `This leave type requires at least ${formatLeaveDays(minDays)} day(s). Requested: ${formatLeaveDays(totalDays)}.`,
        });
        return;
      }
      if (maxDays != null && totalDays > maxDays) {
        setMessage({
          type: "err",
          text: `This leave type allows at most ${formatLeaveDays(maxDays)} day(s) per request. Requested: ${formatLeaveDays(totalDays)}.`,
        });
        return;
      }
    }
    const effectiveEndDate = durationKind === "FullDay" ? endDate : startDate;
    if (!startDate) {
      setMessage({ type: "err", text: applySingleDayOnly ? "Select a date." : "Select both From and To dates." });
      return;
    }
    if (durationKind === "FullDay" && !endDate) {
      setMessage({ type: "err", text: "Select both From and To dates." });
      return;
    }
    if (durationKind === "FullDay" && effectiveEndDate < startDate) {
      setMessage({ type: "err", text: "To date cannot be before From date." });
      return;
    }
    const typeName = selectedLeaveType?.name ?? "leave";
    const durationLabel = formatLeaveDurationLabel(durationKind, halfDayPeriod, effectiveShortLeaveHours);
    const confirmDetail = durationLabel
      ? `Submit this ${formatLeaveDays(totalDays)}-day ${typeName} (${durationLabel}) on ${startDate}? It will go to your approver if required.`
      : `Submit this ${formatLeaveDays(totalDays)}-day ${typeName} request from ${startDate} to ${endDate}? It will go to your approver if required.`;
    if (
      !(await appConfirm(
        confirmDetail,
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
        fd.set("endDate", effectiveEndDate);
        fd.set("totalDays", String(totalDays));
        fd.set("durationKind", durationKind);
        if (durationKind === "HalfDay") fd.set("halfDayPeriod", halfDayPeriod);
        if (durationKind === "ShortLeave") {
          fd.set("shortLeaveHours", String(effectiveShortLeaveHours));
          fd.set("shortLeaveStartTime", shortLeaveStartTime);
          fd.set("shortLeaveEndTime", shortLeaveEndTime);
        }
        if (reason.trim()) fd.set("reason", reason.trim());
        if (coveragePerson.trim()) fd.set("coveragePerson", coveragePerson.trim());
        if (coverageEmployeeId) fd.set("coverageEmployeeId", coverageEmployeeId);
        fd.set("medicalCertificate", medicalFile, medicalFile.name);
        await apiFetch("/api/leave/requests/with-document", { method: "POST", body: fd });
      } else {
        await apiFetch("/api/leave/requests", {
          method: "POST",
          body: JSON.stringify({
            employeeId: selectedEmpId,
            leaveTypeId: selectedTypeId,
            startDate,
            endDate: effectiveEndDate,
            totalDays,
            durationKind,
            halfDayPeriod: durationKind === "HalfDay" ? halfDayPeriod : null,
            shortLeaveHours: durationKind === "ShortLeave" ? effectiveShortLeaveHours : null,
            shortLeaveStartTime: durationKind === "ShortLeave" ? shortLeaveStartTime : null,
            shortLeaveEndTime: durationKind === "ShortLeave" ? shortLeaveEndTime : null,
            reason: reason || null,
            coveragePerson: coveragePerson || null,
            coverageEmployeeId: coverageEmployeeId || null,
          }),
        });
      }
      setMessage({ type: "ok", text: "Leave request submitted successfully!" });
      await appAlert("Leave request submitted successfully!", "Success");
      setSelectedTypeId("");
      setStartDate("");
      setEndDate("");
      setShortLeaveStartTime("");
      setShortLeaveEndTime("");
      setReason("");
      setCoveragePerson("");
      setCoverageEmployeeId("");
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
  const applyLabel = "mb-1 block text-xs font-medium text-slate-600";
  const applyInput =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

  function renderEmployeeAvatar(emp: EmployeeLookup, size: "sm" | "md" = "md") {
    const dim = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
    return (
      <div
        className={`flex ${dim} shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white`}
      >
        {emp.profileImageUrl ? (
          <img
            src={
              /^https?:\/\//i.test(emp.profileImageUrl)
                ? emp.profileImageUrl
                : `${apiOrigin}${emp.profileImageUrl.startsWith("/") ? "" : "/"}${emp.profileImageUrl}`
            }
            alt=""
            className={`${dim} object-cover`}
          />
        ) : (
          `${emp.firstName[0] ?? ""}${emp.lastName[0] ?? ""}`
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      {(!selectedEmpId || isEmployeeView) && (
      <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800">Apply leave</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {isEmployeeView
                ? "Choose a leave type, pick your dates, and submit."
                : "Search for an employee — the form opens automatically."}
            </p>
          </div>
          {!isEmployeeView && !selectedEmpId && (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:max-w-2xl">
              <div className="w-full sm:w-48">
                <label className={applyLabel}>Department</label>
                <FormSelect
                  value={departmentFilterId}
                  onValueChange={onDepartmentFilterChange}
                  options={departmentFilterOptions}
                  className="w-full"
                  clearable={false}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className={applyLabel}>Employee</label>
                <EmployeeSearchCombobox
                  key={departmentFilterId || "all-departments"}
                  value={selectedEmpId}
                  departmentId={departmentFilterId || undefined}
                  placeholder="Search by name or employee code…"
                  className="w-full"
                  onPick={(emp) => {
                    if (emp) selectEmployee(emp);
                    else clearSelectedEmployee();
                  }}
                />
              </div>
            </div>
          )}
          {isEmployeeView && !currentEmployeeId && (
            <p className="text-sm font-medium text-amber-700">Your account is not linked to an employee profile.</p>
          )}
        </div>
      </div>
      )}

      {!selectedEmpId && !isEmployeeView && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
          Search for an employee above to open the leave request form.
        </p>
      )}

      {!selectedEmpId && isEmployeeView && currentEmployeeId && employeesLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          Loading your profile…
        </div>
      )}

      {selectedEmpId && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {selectedEmp && (
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
              {renderEmployeeAvatar(selectedEmp, "sm")}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {selectedEmp.firstName} {selectedEmp.lastName}
                  {selectedEmp.employeeCode ? (
                    <span className="ml-1.5 font-normal text-slate-400">({selectedEmp.employeeCode})</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{currentYear} leave balances</p>
              </div>
              {!isEmployeeView && (
                <button
                  type="button"
                  onClick={clearSelectedEmployee}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Change
                </button>
              )}
            </div>
          )}

          {loadingBal && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
              Loading leave balances…
            </div>
          )}

          {!loadingBal && catalogLeaveTypes.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500 sm:px-5">
              No active leave types in the catalog. Add types under <span className="font-medium">Leave Master</span>.
            </p>
          )}

          {!loadingBal && catalogLeaveTypes.length > 0 && leaveTypesForApply.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-amber-900 sm:px-5">
              No leave types available for {currentYear}. Ask HR to assign balances under{" "}
              <span className="font-medium">Leave balances</span>.
            </p>
          )}

          {!loadingBal && leaveTypesForApply.length > 0 && (
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <label className={applyLabel}>Leave type</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {leaveTypesForApply.map((t) => {
                  const { balance, isNoPayRow, isSickRow, isShortLeaveRow, rowDisabled } = getApplyLeaveTypeMeta(t, balances);
                  const isSelected = t.id === selectedTypeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={rowDisabled}
                      onClick={() => setSelectedTypeId(t.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}
                    >
                      <span>{t.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {balance
                          ? isShortLeaveType(t)
                            ? `${formatLeaveDays(Number(balance.remaining) * LEAVE_WORKDAY_HOURS)}h left`
                            : `${balance.remaining}d left`
                          : isNoPayRow
                            ? "Unpaid"
                            : isSickRow
                              ? "Sick"
                              : isShortLeaveRow
                                ? `${clampShortLeaveHours(t.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS)}h`
                                : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTypeId && !loadingBal && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-4 py-4 sm:px-5 sm:py-5"
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

              {isShortLeaveSelected && selectedLeaveType && !selectedBalance && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/80 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedLeaveType.name}</span>
                  <span className="text-[11px] text-slate-600">
                    Short leave does not require a pre-assigned day balance. Choose hours below and submit.
                  </span>
                </div>
              )}

              {selectedBalance && !isNoPayLeave && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/80 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedBalance.leaveTypeName}</span>
                  <span className="hidden h-4 w-px bg-slate-200 sm:block" />
                  <span className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Avail.</span>{" "}
                    <span className="font-bold text-blue-600">
                      {isShortLeaveSelected
                        ? `${formatLeaveDays(Number(selectedBalance.remaining) * LEAVE_WORKDAY_HOURS)}h`
                        : `${selectedBalance.remaining}d`}
                    </span>
                  </span>
                  {totalDays > 0 && (
                    <>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">Req.</span>{" "}
                        <span
                          className={`font-bold ${totalDays > selectedBalance.remaining ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {isShortLeaveSelected
                            ? `${formatLeaveDays(totalDays * LEAVE_WORKDAY_HOURS)}h`
                            : `${formatLeaveDays(totalDays)}d`}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">After</span>{" "}
                        <span
                          className={`font-bold ${selectedBalance.remaining - totalDays < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {isShortLeaveSelected
                            ? `${formatLeaveDays((selectedBalance.remaining - totalDays) * LEAVE_WORKDAY_HOURS)}h`
                            : `${formatLeaveDays(selectedBalance.remaining - totalDays)}d`}
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
                  Not enough balance: {formatLeaveDays(selectedBalance.remaining)} available vs {formatLeaveDays(totalDays)} requested.
                </div>
              )}

              <div className="space-y-5">
              {(allowHalfDay) && (
                <div>
                  <label className={applyLabel}>Duration</label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(
                      [
                        { value: "FullDay" as const, label: "Full day" },
                        ...(allowHalfDay ? [{ value: "HalfDay" as const, label: "Half day" }] : []),
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setDurationKind(opt.value);
                          if (opt.value !== "FullDay" && startDate) setEndDate(startDate);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          durationKind === opt.value
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {durationKind === "HalfDay" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([
                        { value: "Morning" as const, label: "Morning" },
                        { value: "Afternoon" as const, label: "Afternoon" },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setHalfDayPeriod(opt.value)}
                          className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                            halfDayPeriod === opt.value
                              ? "border-sky-600 bg-sky-50 text-sky-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className={applySingleDayOnly ? "max-w-xs" : "grid gap-3 sm:grid-cols-2"}>
                <div>
                  <label className={applyLabel}>{applySingleDayOnly ? "Date *" : "From *"}</label>
                  <DatePickerField
                    required
                    value={startDate}
                    onChange={onApplyStartDateChange}
                    className={applyInput}
                  />
                </div>
                {!applySingleDayOnly && (
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
                )}
              </div>
              {applyDatesInvalid && (
                <p className="text-xs text-red-600">To date must be on or after From date.</p>
              )}
              {isShortLeaveSelected && selectedLeaveType && (
                <div>
                  {!shortLeaveFixedDuration && (
                    <div className="mb-4">
                      <label className={applyLabel}>Hours *</label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {shortLeaveHourOptions.map((hours) => (
                          <button
                            key={hours}
                            type="button"
                            onClick={() => onShortLeaveHoursChange(hours)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                              shortLeaveDurationHours === hours
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                            }`}
                          >
                            {hours}h
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <label className={applyLabel}>Time *</label>
                  <div className="mt-1.5 grid max-w-md gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
                      <TimePickerField
                        value={shortLeaveStartTime}
                        onChange={onShortLeaveStartTimeChange}
                        minuteStep={15}
                        hourStart={SHORT_LEAVE_DAY_START_HOUR}
                        hourEnd={SHORT_LEAVE_DAY_END_HOUR}
                        maxTime={shortLeaveStartMaxTime}
                        className={applyInput}
                        placeholder="Start time"
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
                      <TimePickerField
                        value={shortLeaveEndTime}
                        onChange={onShortLeaveEndTimeChange}
                        minuteStep={15}
                        hourStart={SHORT_LEAVE_DAY_START_HOUR}
                        hourEnd={SHORT_LEAVE_DAY_END_HOUR}
                        minTime={shortLeaveEndMinTime}
                        maxTime={shortLeaveEndMaxTime}
                        disabled={!shortLeaveStartTime || shortLeaveFixedDuration}
                        className={applyInput}
                        placeholder="End time"
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {shortLeaveFixedDuration
                      ? `Duration is fixed at ${shortLeaveDurationHours} hour(s). End time fills automatically from the start time.`
                      : `Choose hours, then a start time — end time fills automatically (for example 1.5h). You can still adjust To within ${shortLeaveMinHours}h–${shortLeaveMaxHours}h.`}
                    {effectiveShortLeaveHours > 0 ? ` Selected: ${effectiveShortLeaveHours}h.` : ""}
                  </p>
                </div>
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

              <div>
                <label className={applyLabel} htmlFor="apply-leave-comments">Comments *</label>
                <textarea
                  id="apply-leave-comments"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  className={applyInput + " min-h-[4.5rem] resize-y"}
                  placeholder="Enter a comment"
                />
              </div>
              <div>
                <label className={applyLabel}>
                  Coverage person <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <EmployeeSearchCombobox
                  key={`coverage-${selectedEmpId}`}
                  value={coverageEmployeeId}
                  ariaLabel="Coverage person"
                  placeholder="Start typing a colleague’s name…"
                  allowClear
                  clearLabel="Clear coverage person"
                  excludeEmployeeIds={selectedEmpId ? [selectedEmpId] : []}
                  className="w-full max-w-xl"
                  onPick={(emp) => {
                    if (!emp) {
                      setCoverageEmployeeId("");
                      setCoveragePerson("");
                      return;
                    }
                    setCoverageEmployeeId(emp.id);
                    setCoveragePerson(formatCoveragePersonLabel(emp));
                  }}
                />
              </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetApplyLeaveForm}
                  disabled={submitting}
                  className="inline-flex min-h-[2.75rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear form
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !reason.trim() ||
                    !applyDatesReady ||
                    exceedsBalance ||
                    missingBalance ||
                    (sickLeaveRequiresMedicalPdf && !medicalFile)
                  }
                  className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
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
      )}

      <ToastPopup
        open={annualNoticeOpen}
        onDismiss={() => setAnnualNoticeOpen(false)}
        title="Annual leave notice"
        message="If you require to utilize your Annual Leave balance, it must be informed at least 3 days prior. You may apply for emergency leave if needed."
        confirmLabel="Okay"
        autoDismiss={false}
      />
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
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [balanceViewMode, setBalanceViewMode] = useState<"summary" | "detail">("summary");
  const [employeePageSize, setEmployeePageSize] = useState(50);

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

  const leaveTypeFilterOptions = useMemo<FormSelectOption[]>(() => {
    const names = new Set<string>();
    for (const s of summaries) {
      for (const b of s.balances) names.add(b.leaveTypeName);
    }
    return [
      { value: "", label: "All leave types" },
      ...Array.from(names)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name })),
    ];
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    const isExcelEmployee = (s: BalanceSummary) =>
      s.balances.some((b) => {
        if (/compensatory|special grant|freelancer/i.test(b.leaveTypeName)) return true;
        return b.entitled !== 0 || b.used !== 0 || b.carriedForward !== 0 || (b.broughtForwardDays ?? 0) !== 0 || b.remaining !== 0;
      });
    const excelUploaded = summaries.some(isExcelEmployee);
    return summaries
      .filter((s) => {
        if (excelUploaded && !isExcelEmployee(s)) return false;
        if (q) {
          const matchesSearch =
            s.employeeName.toLowerCase().includes(q) ||
            (s.employeeCode?.toLowerCase().includes(q) ?? false);
          if (!matchesSearch) return false;
        }
        if (leaveTypeFilter) {
          const b = s.balances.find((row) => row.leaveTypeName === leaveTypeFilter);
          if (!b) return false;
          const hasStock = b.entitled !== 0 || b.used !== 0 || b.carriedForward !== 0 || b.remaining !== 0;
          if (!hasStock) return false;
        }
        return true;
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [summaries, employeeSearch, leaveTypeFilter]);

  const importedGrantHint = useMemo(() => {
    const count = summaries.filter((s) =>
      s.balances.some(
        (b) =>
          /compensatory|special grant|freelancer/i.test(b.leaveTypeName) &&
          (b.entitled !== 0 || b.used !== 0 || b.remaining !== 0),
      ),
    ).length;
    if (count === 0) return "";
    return `Showing employees from the leave-balance import (${count} with Compensatory Off / Special Grant).`;
  }, [summaries]);

  const leaveTypeColumns = useMemo(() => {
    const names = new Set<string>();
    for (const s of filteredSummaries) {
      for (const b of s.balances) names.add(b.leaveTypeName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [filteredSummaries]);

  const summariesPager = useClientPagination(filteredSummaries, employeePageSize);

  useEffect(() => {
    if (!recalcMsg) return;
    const timer = window.setTimeout(() => setRecalcMsg(""), 5000);
    return () => window.clearTimeout(timer);
  }, [recalcMsg]);

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
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title={`Leave balances — ${year}`}
        subtitle={
          <>
            Entitlement, usage, and days remaining as of <span className="font-medium text-slate-700">{asOfMonthLabel}</span>.
            Carried is the usable carry pool for the selected month.
          </>
        }
        badge={
          <Button type="button" onClick={handleRecalculate} disabled={recalculating} className="shrink-0">
            {recalculating ? "Recalculating…" : "Recalculate balances"}
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)_9rem_9rem_9rem]">
          <div>
            <label className={labelClass}>Search employee</label>
            <input
              type="search"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(sanitizeSearchInput(e.target.value))}
              placeholder="Name or employee code…"
              className={inputClass + " w-full"}
            />
          </div>
          <div>
            <label className={labelClass}>Leave type</label>
            <FormSelect
              value={leaveTypeFilter}
              onValueChange={setLeaveTypeFilter}
              options={leaveTypeFilterOptions}
              className="w-full"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>Year</label>
            <FormSelect
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              options={LEAVE_YEAR_FORM_OPTIONS}
              className="w-full"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>As-of month</label>
            <FormSelect
              value={String(asOfMonth)}
              onValueChange={(v) => setAsOfMonth(Number(v))}
              options={AS_OF_MONTH_FORM_OPTIONS}
              className="w-full"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>Rows per page</label>
            <FormSelect
              value={String(employeePageSize)}
              onValueChange={(v) => setEmployeePageSize(Number(v))}
              options={[
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
              className="w-full"
              clearable={false}
            />
          </div>
        </div>
      </div>

      {recalcMsg ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            recalcMsg.startsWith("Done")
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {recalcMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            {importedGrantHint ||
              (balanceViewMode === "summary"
                ? "One row per employee — best for large teams."
                : "All balance lines — click edit on any row.")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">View</span>
            <button
              type="button"
              onClick={() => setBalanceViewMode("summary")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                balanceViewMode === "summary"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setBalanceViewMode("detail")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                balanceViewMode === "detail"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Detail
            </button>
          </div>
        </div>
        <div className="max-h-[min(78vh,56rem)] overflow-x-auto overflow-y-auto">
          {balanceViewMode === "summary" ? (
            <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-xs">
              <thead className="bg-slate-50/90">
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"
                  >
                    ID
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"
                  >
                    Name
                  </th>
                  {leaveTypeColumns.map((type) => (
                    <th
                      key={type}
                      colSpan={2}
                      className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600 backdrop-blur"
                    >
                      <span className="line-clamp-2">{type}</span>
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"
                  >
                    Used
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-10 border-b border-emerald-200 bg-emerald-50/90 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-emerald-800 backdrop-blur"
                  >
                    Remain
                  </th>
                </tr>
                <tr>
                  {leaveTypeColumns.map((type) => (
                    <Fragment key={`${type}-sub`}>
                      <th className="sticky top-[1.75rem] z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-1 text-right text-[9px] font-medium uppercase tracking-wide text-slate-400 backdrop-blur">
                        Used
                      </th>
                      <th className="sticky top-[1.75rem] z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-1 text-right text-[9px] font-medium uppercase tracking-wide text-emerald-700 backdrop-blur">
                        Rem.
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sum-sk-${i}`} className="animate-pulse">
                      <td colSpan={leaveTypeColumns.length * 2 + 4} className="px-3 py-1.5">
                        <div className="h-6 rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))}
                {!loading && filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(leaveTypeColumns.length * 2 + 4, 4)} className="px-4 py-12 text-center text-sm text-slate-500">
                      {employeeSearch.trim()
                        ? "No employees match your search."
                        : `No balances for ${year} as of ${asOfMonthLabel}.`}
                    </td>
                  </tr>
                )}
                {!loading &&
                  summariesPager.pageItems.map((s) => {
                    const balanceByType = new Map<string, BalanceItem>();
                    for (const b of s.balances) {
                      const key = b.leaveTypeId || b.leaveTypeName;
                      const prev = balanceByType.get(key);
                      if (!prev) {
                        balanceByType.set(key, b);
                        continue;
                      }
                      const score = (x: BalanceItem) =>
                        Math.abs(x.entitled) + Math.abs(x.used) + Math.abs(x.carriedForward) + Math.abs(x.remaining);
                      if (score(b) > score(prev)) balanceByType.set(key, b);
                    }
                    const uniqueBalances = Array.from(balanceByType.values());
                    const totalUsed = uniqueBalances.reduce((sum, b) => sum + b.used, 0);
                    const totalRemaining = uniqueBalances.reduce((sum, b) => sum + b.remaining, 0);
                    const columnByType = new Map(uniqueBalances.map((b) => [b.leaveTypeName, b]));
                    return (
                      <tr key={s.employeeId} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-500">
                          {s.employeeCode || "—"}
                        </td>
                        <td className="max-w-[12rem] px-3 py-1.5">
                          <p className="truncate font-medium text-slate-800">{s.employeeName}</p>
                        </td>
                        {leaveTypeColumns.map((type) => {
                          const b = columnByType.get(type);
                          const rem = b?.remaining ?? null;
                          const remClass =
                            rem == null ? "text-slate-300" : rem > 0 ? "text-emerald-700" : rem < 0 ? "text-rose-700" : "text-slate-400";
                          return (
                            <Fragment key={type}>
                              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                                {b ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditBalance(b)}
                                    className="rounded px-1.5 py-0.5 transition hover:bg-slate-100"
                                    title={`Edit ${type} — used`}
                                  >
                                    {b.used}
                                  </button>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {b ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditBalance(b)}
                                    className={`rounded px-1.5 py-0.5 font-semibold transition hover:bg-slate-100 ${remClass}`}
                                    title={`Edit ${type} — remaining`}
                                  >
                                    {b.remaining}
                                  </button>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums text-slate-700">{totalUsed}</td>
                        <td className="bg-emerald-50/30 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-800">
                          {totalRemaining}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : (
          <table className="w-full min-w-[52rem] border-separate border-spacing-0 text-xs">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  ID
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Name
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Leave type
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Period
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Ent.
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Used
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Carr.
                </th>
                <th className="sticky top-0 z-10 border-b border-emerald-200 bg-emerald-50/90 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-emerald-800 backdrop-blur">
                  Rem.
                </th>
                <th
                  className="sticky top-0 z-10 w-10 border-b border-slate-200 bg-slate-50/95 py-2 pr-2 backdrop-blur"
                  aria-label="Actions"
                />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`bal-sk-${i}`} className="animate-pulse">
                    <td colSpan={9} className="px-3 py-1.5">
                      <div className="h-6 rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!loading && filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <h3 className="text-sm font-semibold text-slate-800">No balances found</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {employeeSearch.trim()
                          ? "Try a different search term."
                          : `No data for ${year} as of ${asOfMonthLabel}.`}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                summariesPager.pageItems.map((s) =>
                  s.balances.map((b, idx) => {
                    const rem = b.remaining;
                    const remClass =
                      rem > 0 ? "text-emerald-700" : rem < 0 ? "text-rose-700" : "text-slate-500";
                    return (
                      <tr
                        key={`${s.employeeId}-${b.id}`}
                        className="border-b border-slate-100 transition hover:bg-slate-50/70"
                      >
                        {idx === 0 ? (
                          <>
                            <td
                              rowSpan={s.balances.length}
                              className="whitespace-nowrap border-r border-slate-100 bg-slate-50/40 px-2 py-1.5 align-top tabular-nums text-slate-500"
                            >
                              {s.employeeCode || "—"}
                            </td>
                            <td
                              rowSpan={s.balances.length}
                              className="max-w-[11rem] border-r border-slate-100 bg-slate-50/40 px-2 py-1.5 align-top"
                            >
                              <p className="truncate font-medium text-slate-800">{s.employeeName}</p>
                            </td>
                          </>
                        ) : null}
                        <td className="px-2 py-1.5 text-slate-700">{b.leaveTypeName}</td>
                        <td className="px-2 py-1.5 text-slate-500">{b.periodLabel ?? b.year}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{b.entitled}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{b.used}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{b.carriedForward}</td>
                        <td className="bg-emerald-50/30 px-2 py-1.5 text-right">
                          <span className={`font-semibold tabular-nums ${remClass}`}>{b.remaining}</span>
                        </td>
                        <td className="px-1 py-1.5 pr-2 text-right">
                          <button
                            type="button"
                            onClick={() => openEditBalance(b)}
                            className="inline-flex rounded p-1 text-slate-400 transition hover:bg-white hover:text-blue-700"
                            title="Edit"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  }),
                )}
            </tbody>
          </table>
          )}
        </div>
        <TablePagination
          page={summariesPager.page}
          totalPages={summariesPager.totalPages}
          totalCount={summariesPager.totalCount}
          pageSize={summariesPager.pageSize}
          onPageChange={summariesPager.setPage}
        />
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
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Remaining:{" "}
            <span className="font-semibold tabular-nums text-slate-800">
              {(() => {
                const entitled = Number(editEntitled) || 0;
                const used = Number(editUsed) || 0;
                const carried = Number(editCarriedForward) || 0;
                return computeLeaveRemaining(entitled, used, carried);
              })()}
            </span>
            {" "}days
          </p>
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [employeeSearchKey, setEmployeeSearchKey] = useState(0);
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
    apiFetch<LeaveTypeItem[]>("/api/leave/types")
      .then(setLeaveTypes)
      .catch(() => setFormError("Could not load leave types."))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  useEffect(() => {
    if (!formError) return;
    const timer = window.setTimeout(() => setFormError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [formError]);

  const selectedLeaveType = leaveTypes.find((t) => t.id === addLeaveTypeId);
  const remainingPreview = useMemo(() => {
    const entitled = Number(addEntitled) || 0;
    const used = Number(addUsed) || 0;
    const carried = Number(addCarriedForward) || 0;
    return computeLeaveRemaining(entitled, used, carried);
  }, [addEntitled, addUsed, addCarriedForward]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmployeeId) {
      setFormError("Please search and select an employee.");
      return;
    }
    if (!addLeaveTypeId) {
      setFormError("Please select a leave type.");
      return;
    }
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
      setEmployeeSearchKey((k) => k + 1);
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
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title="Leave Assignment"
        subtitle="Create a leave balance for one employee and leave type — for a calendar year or a custom date range."
      />

      {catalogLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          Loading leave types…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New balance line</p>
            <p className="mt-0.5 text-sm text-slate-600">
              After saving, review balances under <span className="font-medium text-slate-800">Leave Balances</span> or run
              recalculation if needed.
            </p>
          </div>

          <div className="space-y-5 px-4 py-5 sm:px-5">
            <FormErrorAlert
              message={formError}
              onDismiss={() => setFormError(null)}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            />
            <InlinePageAlert
              message={successMsg}
              variant="success"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 scroll-mt-20"
            />

            <div className="space-y-5">
              <div>
                <label className={labelClass}>Employee *</label>
                <div className="max-w-md">
                  <EmployeeSearchCombobox
                    key={employeeSearchKey}
                    value={addEmployeeId}
                    placeholder="Search by name or employee code…"
                    onPick={(emp) => setAddEmployeeId(emp?.id ?? "")}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                <div className="max-w-sm">
                  <label className={labelClass}>Leave type *</label>
                  <FormSelect
                    value={addLeaveTypeId}
                    onValueChange={setAddLeaveTypeId}
                    options={addLeaveTypeFormOptions}
                    placeholder="Select leave type…"
                    required
                    className="w-full"
                  />
                  {selectedLeaveType ? (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Catalog default: {selectedLeaveType.defaultDaysPerYear} days/year
                      {selectedLeaveType.description ? ` · ${selectedLeaveType.description}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="max-w-sm">
                  <label className={labelClass}>Leave period *</label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAddPeriodKind("year")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        addPeriodKind === "year"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Calendar year
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddPeriodKind("custom")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        addPeriodKind === "custom"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Custom period
                    </button>
                  </div>
                  {addPeriodKind === "year" ? (
                    <FormSelect
                      value={String(addYear)}
                      onValueChange={(v) => setAddYear(Number(v))}
                      options={addYearFormOptions}
                      placeholder={String(addYear)}
                      clearable={false}
                      className="w-full"
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

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Balance days</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Entitled</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={addEntitled}
                        onChange={(e) => setAddEntitled(e.target.value)}
                        className={inputClass + " w-full"}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Used</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={addUsed}
                        onChange={(e) => setAddUsed(e.target.value)}
                        className={inputClass + " w-full"}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Carried</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={addCarriedForward}
                        onChange={(e) => setAddCarriedForward(e.target.value)}
                        className={inputClass + " w-full"}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Estimated remaining:{" "}
                    <span
                      className={`font-bold tabular-nums ${remainingPreview < 0 ? "text-rose-600" : "text-emerald-700"}`}
                    >
                      {remainingPreview}
                    </span>{" "}
                  days
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setAddEmployeeId("");
                setEmployeeSearchKey((k) => k + 1);
                setAddLeaveTypeId("");
                setAddPeriodKind("year");
                setAddYear(new Date().getFullYear());
                setAddPeriodStart("");
                setAddPeriodEnd("");
                setAddEntitled("0");
                setAddUsed("0");
                setAddCarriedForward("0");
                setFormError(null);
                setSuccessMsg(null);
              }}
            >
              Clear form
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[10rem]">
              {saving ? "Saving…" : "Save leave assignment"}
            </Button>
          </div>
        </form>
      )}
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
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePageSize, setEmployeePageSize] = useState(50);
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

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      const code = e.employeeCode?.toLowerCase() ?? "";
      return name.includes(q) || code.includes(q);
    });
  }, [employees, employeeSearch]);

  const allSelected = useMemo(
    () => filteredEmployees.length > 0 && filteredEmployees.every((e) => includeById[e.id]),
    [filteredEmployees, includeById],
  );
  const someSelected = useMemo(
    () => filteredEmployees.some((e) => includeById[e.id]),
    [filteredEmployees, includeById],
  );

  useEffect(() => {
    const el = headerIncludeRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function setAllIncluded(checked: boolean) {
    setIncludeById((prev) => {
      const next = { ...prev };
      for (const e of filteredEmployees) next[e.id] = checked;
      return next;
    });
  }

  const totalAvailableListed = useMemo(
    () => filteredEmployees.reduce((sum, e) => sum + (availableByEmployeeId[e.id] ?? 0), 0),
    [filteredEmployees, availableByEmployeeId],
  );

  function fmtDays(n: number) {
    if (n === 0) return "0";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  const employeesPager = useClientPagination(filteredEmployees, employeePageSize);

  const selectedCount = useMemo(
    () => filteredEmployees.filter((e) => includeById[e.id]).length,
    [filteredEmployees, includeById],
  );

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

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
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title="Carry forward"
        subtitle={
          <>
            Move unused leave from <span className="font-medium text-slate-700">{fromYear}</span> into{" "}
            <span className="font-medium text-slate-700">{toYear}</span>. Only policy-eligible types are processed.
            Unchecked employees are skipped.
          </>
        }
        badge={
          <Button
            onClick={handleRun}
            disabled={running || toYear !== fromYear + 1 || empLoading || selectedCount === 0}
            className="shrink-0"
          >
            {running ? "Processing…" : "Run carry forward"}
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Year range</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
          <div>
            <label className={labelClass}>From year (source)</label>
            <FormSelect
              value={String(fromYear)}
              onValueChange={(v) => setFromYear(Number(v))}
              options={fromYearOptions}
              className="w-full"
              clearable={false}
            />
          </div>
          <div>
            <label className={labelClass}>To year (target)</label>
            <FormSelect
              value={String(toYear)}
              onValueChange={(v) => setToYear(Number(v))}
              options={toYearOptions}
              className="w-full"
              clearable={false}
            />
          </div>
        </div>
        {toYear !== fromYear + 1 && (
          <p className="mt-3 text-xs text-amber-700">To year must be exactly one year after the from year.</p>
        )}
      </div>

      {!empLoading && employees.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-800">{selectedCount}</span> of{" "}
            <span className="font-semibold text-slate-800">{filteredEmployees.length}</span> selected
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span className="text-slate-600">
            Available in {fromYear}:{" "}
            {balanceLoading ? (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200 align-middle" />
            ) : (
              <span className="font-bold tabular-nums text-emerald-700">{fmtDays(totalAvailableListed)} days</span>
            )}
          </span>
        </div>
      )}

      <FormErrorAlert message={error} onDismiss={() => setError(null)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" />

      {result && (
        <div className="space-y-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Carry forward completed</p>
            <p className="mt-1">
              Processed {result.balancesProcessed} rows · Created {result.balancesCreated} · Updated{" "}
              {result.balancesUpdated} · Carried {result.totalDaysCarried} days
            </p>
          </div>
          {result.infoMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{result.infoMessage}</div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Employee selection — {fromYear} → {toYear}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Check employees to include in this carry forward run.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
              <div>
                <label className={labelClass}>Search</label>
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(sanitizeSearchInput(e.target.value))}
                  placeholder="Name or employee ID…"
                  className={inputClass + " w-full"}
                />
              </div>
              <div>
                <label className={labelClass}>Rows per page</label>
                <FormSelect
                  value={String(employeePageSize)}
                  onValueChange={(v) => setEmployeePageSize(Number(v))}
                  options={[
                    { value: "25", label: "25" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                  className="w-full"
                  clearable={false}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="max-h-[min(72vh,52rem)] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-xs">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="sticky top-0 z-10 w-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 backdrop-blur">
                  <span className="sr-only">Include</span>
                  <input
                    ref={headerIncludeRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setAllIncluded(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    title="Select or clear all on this page"
                  />
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  ID
                </th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  Name
                </th>
                <th className="sticky top-0 z-10 border-b border-emerald-200 bg-emerald-50/90 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-emerald-800 backdrop-blur">
                  Available
                </th>
              </tr>
            </thead>
            <tbody>
              {empLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`cf-sk-${i}`} className="animate-pulse">
                    <td colSpan={4} className="px-3 py-1.5">
                      <div className="h-6 rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!empLoading && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                    {employeeSearch.trim() ? "No employees match your search." : "No employees found."}
                  </td>
                </tr>
              )}
              {!empLoading &&
                employeesPager.pageItems.map((e) => {
                  const n = availableByEmployeeId[e.id] ?? 0;
                  const remClass = n > 0 ? "text-emerald-700" : n < 0 ? "text-rose-700" : "text-slate-400";
                  const included = includeById[e.id] !== false;
                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-100 transition hover:bg-slate-50/80 ${included ? "" : "opacity-60"}`}
                    >
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={(ev) =>
                            setIncludeById((prev) => ({ ...prev, [e.id]: ev.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-500">
                        {e.employeeCode ?? "—"}
                      </td>
                      <td className="max-w-[14rem] px-3 py-1.5 font-medium text-slate-800">
                        <span className="truncate">{e.firstName} {e.lastName}</span>
                      </td>
                      <td className="bg-emerald-50/20 px-2 py-1.5 text-right">
                        {balanceLoading ? (
                          <span className="inline-block h-4 w-8 animate-pulse rounded bg-slate-200" />
                        ) : (
                          <span className={`font-semibold tabular-nums ${remClass}`}>{fmtDays(n)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={employeesPager.page}
          totalPages={employeesPager.totalPages}
          totalCount={employeesPager.totalCount}
          pageSize={employeesPager.pageSize}
          onPageChange={employeesPager.setPage}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4a – Leave Types Tab
// ═══════════════════════════════════════════════════════════════

function parseOptionalDays(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function LeaveTypesTab() {
  const [items, setItems] = useState<LeaveTypeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [saving, setSaving] = useState(false);
  const editingShortLeave = isShortLeaveType(editing);

  const load = useCallback(() => { apiFetch<LeaveTypeItem[]>("/api/leave/types").then(setItems); }, []);
  useEffect(() => { load(); }, [load]);
  const itemsPager = useClientPagination(items);

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }
  function openEdit(item: LeaveTypeItem) {
    setEditing(item);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get("code") as string;
    const isShort = isShortLeaveType({ code, allowShortLeave: isShortLeaveType(editing) });
    const shortLeaveHours = clampShortLeaveHours(Number(fd.get("shortLeaveHours") || editing?.shortLeaveHours || DEFAULT_SHORT_LEAVE_HOURS));
    const minHours = isShort ? parseOptionalHours(fd.get("minHours")) : null;
    const maxHours = isShort ? parseOptionalHours(fd.get("maxHours")) : null;
    if (isShort && minHours != null && maxHours != null && minHours > maxHours) {
      setSaving(false);
      await appAlert("Minimum hours cannot be greater than maximum hours.", "Save failed");
      return;
    }
    const payload = {
      name: fd.get("name") as string,
      code,
      description: isShort ? `Short leave of ${shortLeaveHours} hours on a single day` : (fd.get("description") as string || null),
      defaultDaysPerYear: isShort ? 0 : Number(fd.get("defaultDaysPerYear")),
      isPaid: fd.get("isPaid") === "on",
      isActive: fd.get("isActive") === "on",
      allowHalfDay: isShort ? false : fd.get("allowHalfDay") === "on",
      allowShortLeave: isShort,
      shortLeaveHours,
      minHours,
      maxHours,
      minDays: isShort ? null : parseOptionalDays(fd.get("minDays")),
      maxDays: isShort ? null : parseOptionalDays(fd.get("maxDays")),
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/types/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/types", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not save leave type.", "Save failed");
    } finally { setSaving(false); }
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
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Leave Master</h2>
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
                  Entitlement
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[4.5rem] border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Min
                </th>
                <th
                  className="sticky top-0 z-10 min-w-[4.5rem] border-b border-slate-200/90 bg-slate-100/95 px-2 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur"
                  scope="col"
                >
                  Max
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
                  Half day
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
                  <td colSpan={9} className="px-6 py-16 text-center">
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
                    <span className="text-base font-semibold tabular-nums text-emerald-800">
                      {isShortLeaveType(t) ? `${clampShortLeaveHours(t.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS)}h` : t.defaultDaysPerYear}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-700 sm:px-3">
                    {isShortLeaveType(t) ? (
                      t.minHours != null && t.minHours > 0 ? `${t.minHours}h` : <span className="text-slate-400">—</span>
                    ) : t.minDays != null && t.minDays > 0 ? (
                      formatLeaveDays(t.minDays)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-700 sm:px-3">
                    {isShortLeaveType(t) ? (
                      t.maxHours != null && t.maxHours > 0 ? `${t.maxHours}h` : <span className="text-slate-400">—</span>
                    ) : t.maxDays != null && t.maxDays > 0 ? (
                      formatLeaveDays(t.maxDays)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {t.isPaid ? <span className="text-sm font-medium text-emerald-700">Yes</span> : <span className="text-slate-400">No</span>}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {t.allowHalfDay ? <span className="text-sm font-medium text-emerald-700">Yes</span> : <span className="text-slate-400">No</span>}
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
            <div><label className={labelClass}>Code *</label><input name="code" required defaultValue={editing?.code ?? ""} readOnly={editingShortLeave} className={inputClass} /></div>
          </div>
          {!editingShortLeave && (
            <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          )}
          {editingShortLeave ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Hours *</label>
                <input
                  name="shortLeaveHours"
                  type="number"
                  min={1}
                  max={4}
                  step="any"
                  defaultValue={editing?.shortLeaveHours && editing.shortLeaveHours > 0 ? editing.shortLeaveHours : DEFAULT_SHORT_LEAVE_HOURS}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-400">Default hours on one request. Part hours allowed, e.g. 1.5.</p>
              </div>
              <div>
                <label className={labelClass}>Minimum hours</label>
                <input name="minHours" type="number" min={1} max={4} step="any" defaultValue={editing?.minHours ?? ""} placeholder="No minimum" className={inputClass} />
                <p className="mt-1 text-[11px] text-slate-400">Per request. Leave empty for no limit.</p>
              </div>
              <div>
                <label className={labelClass}>Maximum hours</label>
                <input name="maxHours" type="number" min={1} max={4} step="any" defaultValue={editing?.maxHours ?? ""} placeholder="No maximum" className={inputClass} />
                <p className="mt-1 text-[11px] text-slate-400">Per request. Leave empty for no limit.</p>
              </div>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Days/Year *</label>
              <input name="defaultDaysPerYear" type="number" required min={0} defaultValue={editing?.defaultDaysPerYear ?? 14} className={inputClass} />
              <p className="mt-1 text-[11px] text-slate-400">Yearly entitlement (e.g. Casual = 7).</p>
            </div>
            <div>
              <label className={labelClass}>Minimum days</label>
              <input name="minDays" type="number" min={0} step="0.25" defaultValue={editing?.minDays ?? ""} placeholder="No minimum" className={inputClass} />
              <p className="mt-1 text-[11px] text-slate-400">Per request. Leave empty for no limit.</p>
            </div>
            <div>
              <label className={labelClass}>Maximum days</label>
              <input name="maxDays" type="number" min={0} step="0.25" defaultValue={editing?.maxDays ?? ""} placeholder="No maximum" className={inputClass} />
              <p className="mt-1 text-[11px] text-slate-400">Per request. Leave empty for no limit.</p>
            </div>
          </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 pt-1"><input name="isPaid" type="checkbox" defaultChecked={editing?.isPaid ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Paid Leave</label></div>
            <div className="flex items-center gap-2 pt-1"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Active</label></div>
          </div>
          {!editingShortLeave && (
            <div className="flex items-center gap-2 pt-1">
              <input name="allowHalfDay" type="checkbox" defaultChecked={editing?.allowHalfDay ?? false} className="h-4 w-4 rounded border-slate-300" />
              <label className="text-sm text-slate-600">Half Day</label>
            </div>
          )}
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
      sickEntitlementDays: typeof se === "number" && se >= 0 && se <= 366 ? se : 0,
    };
  } catch {
    return {
      intro: DEFAULT_SICK_NARRATIVE.intro,
      points: [...DEFAULT_SICK_NARRATIVE.points],
      sickEntitlementDays: 0,
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

const DEFAULT_SHOP_OFFICE_ANNUAL_NARRATIVE = {
  intro: "Sri Lanka Shop & Office Act — calendar year; annual leave uses employment type and confirmation dates.",
  points: [
    "Joining calendar year: no annual leave. While on probation (employment type or before permanent date): no annual leave.",
    "Permanent for annual leave from Date of permanency, or the day after Probation end date, or from join if employment type is not probation (e.g. Full-Time Permanent).",
    "First eligible calendar year after join (and from permanent year): pro-rated by original join quarter — Jan–Mar 14d, Apr–Jun 10d, Jul–Sep 7d, Oct–Dec 4d",
    "Following calendar years: 14 days per year",
    "Usage: minimum 7 consecutive calendar days per application",
  ],
} as const;

const DEFAULT_SHOP_OFFICE_CASUAL_NARRATIVE = {
  intro: "Sri Lanka Shop & Office Act — casual leave (max 7 days).",
  points: [
    "Joining year: 0.5 day per completed calendar month from join (partial join month excluded), capped at 7",
    "From the next calendar year: 7 days per year",
  ],
} as const;

function parseShopOfficeNarrativeFromRuleConfig(
  ruleConfig: string,
  defaults: { intro: string; points: readonly string[] },
): { intro: string; points: string[] } {
  try {
    const o = JSON.parse(ruleConfig) as { narrative?: { intro?: string; points?: string[] } };
    const points: string[] = [];
    for (let i = 0; i < defaults.points.length; i++) {
      if (o.narrative?.points?.[i] && String(o.narrative.points[i]).trim()) {
        points.push(String(o.narrative.points[i]).trim());
      } else {
        points.push(defaults.points[i] ?? "");
      }
    }
    const intro = (o.narrative?.intro && o.narrative.intro.trim()) ? o.narrative.intro.trim() : defaults.intro;
    return { intro, points };
  } catch {
    return { intro: defaults.intro, points: [...defaults.points] };
  }
}

function mergeShopOfficeNarrativeRuleConfigJson(
  existing: string,
  next: { intro: string; points: string[] },
): string {
  let base: Record<string, unknown> = {};
  try {
    base = (JSON.parse(existing || "{}") as Record<string, unknown>) ?? {};
  } catch {
    /* ignore */
  }
  base.narrative = { intro: next.intro, points: next.points.map((x) => x.trim()) };
  return JSON.stringify(base);
}

function ShopOfficeAnnualNarrativeView({ intro, points }: { intro: string; points: string[] }) {
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
    </div>
  );
}

function ShopOfficeCasualNarrativeView({ intro, points }: { intro: string; points: string[] }) {
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
    </div>
  );
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

function ShopOfficeNarrativeAdminBlock({
  mode,
  rule,
  leaveTypeId,
  ruleType,
  defaults,
  onUpdated,
  entitlementHeader,
  referenceHelperText,
  NarrativeView,
}: {
  mode: "rule" | "reference";
  rule: EntitlementRule | null;
  leaveTypeId: string | null;
  ruleType: "ShopOfficeAnnual" | "ShopOfficeCasual";
  defaults: { intro: string; points: readonly string[] };
  onUpdated: () => void | Promise<void>;
  entitlementHeader: { title: string; ruleType: string; inactive?: boolean };
  referenceHelperText?: string;
  NarrativeView: ComponentType<{ intro: string; points: string[] }>;
}) {
  const initial = useMemo(
    () => parseShopOfficeNarrativeFromRuleConfig(rule?.ruleConfig ?? "{}", defaults),
    [rule?.id, rule?.ruleConfig, mode, defaults],
  );
  const [editing, setEditing] = useState(false);
  const [intro, setIntro] = useState(initial.intro);
  const [points, setPoints] = useState<string[]>(() => [...initial.points]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const p = parseShopOfficeNarrativeFromRuleConfig(rule?.ruleConfig ?? "{}", defaults);
    if (!editing) {
      setIntro(p.intro);
      setPoints([...p.points]);
    }
  }, [rule?.id, rule?.ruleConfig, mode, editing, defaults]);

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const next = { intro, points };
      const config = mergeShopOfficeNarrativeRuleConfigJson(rule?.ruleConfig ?? "{}", next);
      if (mode === "rule" && rule) {
        await apiFetch<{ ruleConfig: string }>(`/api/leave/entitlement-rules/${rule.id}`, { method: "PUT", body: JSON.stringify({ ruleConfig: config }) });
      } else {
        if (!leaveTypeId) {
          const code = ruleType === "ShopOfficeAnnual" ? "LT-ANN" : "LT-CAS";
          setErr(`${code === "LT-ANN" ? "Annual" : "Casual"} leave type (${code}) not found. Add it under Leave Master first.`);
          return;
        }
        await apiFetch("/api/leave/entitlement-rules", {
          method: "POST",
          body: JSON.stringify({ leaveTypeId, ruleType, ruleConfig: config }),
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
    const p = parseShopOfficeNarrativeFromRuleConfig(rule?.ruleConfig ?? "{}", defaults);
    setIntro(p.intro);
    setPoints([...p.points]);
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
          {points.map((_, i) => (
            <div key={i}>
              <label className={labelClass}>Point {i + 1}</label>
              <textarea value={points[i] ?? ""} onChange={(e) => {
                const c = [...points];
                c[i] = e.target.value;
                setPoints(c);
              }} className={inputClass} rows={2} />
            </div>
          ))}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={() => { void save(); }} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : (
        <NarrativeView intro={intro} points={points} />
      )}
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
          setErr("Sick leave type (code LT-SIC) not found. Add it under Leave Master first.");
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
  // One card per leave type (keeps first after sort) so accidental duplicate DB rows do not double-render.
  const sorted = [...rules].sort((a, b) => {
    const oa = ENTITLEMENT_RULE_SORT_ORDER[a.ruleType] ?? 50;
    const ob = ENTITLEMENT_RULE_SORT_ORDER[b.ruleType] ?? 50;
    if (oa !== ob) return oa - ob;
    return a.leaveTypeName.localeCompare(b.leaveTypeName);
  });
  const seen = new Set<string>();
  return sorted.filter((r) => {
    if (seen.has(r.leaveTypeId)) return false;
    seen.add(r.leaveTypeId);
    return true;
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
  const hasShopOfficeAnnualRule = useMemo(() => rules.some((r) => r.ruleType === "ShopOfficeAnnual"), [rules]);
  const hasShopOfficeCasualRule = useMemo(() => rules.some((r) => r.ruleType === "ShopOfficeCasual"), [rules]);
  const hasShopOfficeSickRule = useMemo(() => rules.some((r) => r.ruleType === "ShopOfficeSick"), [rules]);
  const sickCatalogLeaveTypeId = useMemo(
    () => leaveTypes.find((lt) => lt.code === "LT-SIC")?.id ?? null,
    [leaveTypes],
  );
  const annualCatalogLeaveTypeId = useMemo(
    () => leaveTypes.find((lt) => lt.code === "LT-ANN")?.id ?? null,
    [leaveTypes],
  );
  const casualCatalogLeaveTypeId = useMemo(
    () => leaveTypes.find((lt) => lt.code === "LT-CAS")?.id ?? null,
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

            if (rule.ruleType === "ShopOfficeAnnual") {
              return (
                <div key={rule.id} className="px-6 py-4">
                  <ShopOfficeNarrativeAdminBlock
                    mode="rule"
                    rule={rule}
                    leaveTypeId={annualCatalogLeaveTypeId}
                    ruleType="ShopOfficeAnnual"
                    defaults={DEFAULT_SHOP_OFFICE_ANNUAL_NARRATIVE}
                    onUpdated={load}
                    entitlementHeader={{ title: rule.leaveTypeName, ruleType: rule.ruleType, inactive: !rule.isActive }}
                    NarrativeView={ShopOfficeAnnualNarrativeView}
                  />
                </div>
              );
            }

            if (rule.ruleType === "ShopOfficeCasual") {
              return (
                <div key={rule.id} className="px-6 py-4">
                  <ShopOfficeNarrativeAdminBlock
                    mode="rule"
                    rule={rule}
                    leaveTypeId={casualCatalogLeaveTypeId}
                    ruleType="ShopOfficeCasual"
                    defaults={DEFAULT_SHOP_OFFICE_CASUAL_NARRATIVE}
                    onUpdated={load}
                    entitlementHeader={{ title: rule.leaveTypeName, ruleType: rule.ruleType, inactive: !rule.isActive }}
                    NarrativeView={ShopOfficeCasualNarrativeView}
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

        {!hasShopOfficeAnnualRule && (
          <div className="px-6 py-4">
            <ShopOfficeNarrativeAdminBlock
              mode="reference"
              rule={null}
              leaveTypeId={annualCatalogLeaveTypeId}
              ruleType="ShopOfficeAnnual"
              defaults={DEFAULT_SHOP_OFFICE_ANNUAL_NARRATIVE}
              onUpdated={load}
              entitlementHeader={{ title: "Annual Leave", ruleType: "ShopOfficeAnnual (reference)" }}
              referenceHelperText="Shown when no ShopOfficeAnnual rule is linked yet. Save your text below to create the rule, or use seeding to add it from the server."
              NarrativeView={ShopOfficeAnnualNarrativeView}
            />
          </div>
        )}

        {!hasShopOfficeCasualRule && (
          <div className="px-6 py-4">
            <ShopOfficeNarrativeAdminBlock
              mode="reference"
              rule={null}
              leaveTypeId={casualCatalogLeaveTypeId}
              ruleType="ShopOfficeCasual"
              defaults={DEFAULT_SHOP_OFFICE_CASUAL_NARRATIVE}
              onUpdated={load}
              entitlementHeader={{ title: "Casual Leave", ruleType: "ShopOfficeCasual (reference)" }}
              referenceHelperText="Shown when no ShopOfficeCasual rule is linked yet. Save your text below to create the rule, or use seeding to add it from the server."
              NarrativeView={ShopOfficeCasualNarrativeView}
            />
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
  const [holidaySearch, setHolidaySearch] = useState("");
  const [holidaysView, setHolidaysView] = useState<"calendar" | "list">("calendar");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HolidayItem | null>(null);
  const [defaultDate, setDefaultDate] = useState("");
  const [holidayKind, setHolidayKind] = useState<HolidayKind>("Public");
  const [saving, setSaving] = useState(false);
  const [localeSaving, setLocaleSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const countryLabel = locale?.countries.find((c) => c.code === countryCode)?.label ?? countryCode;

  const loadLocale = useCallback(async () => {
    const data = await apiFetch<HolidayLocaleSettings>("/api/leave/holidays/locale");
    setLocale(data);
    setCountryCode(data.countryCode);
    setTimeZoneId(data.timeZoneId);
  }, []);

  const load = useCallback((targetCountry = countryCode) => {
    setLoading(true);
    apiFetch<HolidayItem[]>(
      `/api/leave/holidays?year=${year}&country=${encodeURIComponent(targetCountry)}`,
    )
      .then(setItems)
      .finally(() => setLoading(false));
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
    let list = items;
    if (selectedKinds.length < ALL_HOLIDAY_KINDS.length) {
      const selected = new Set(selectedKinds);
      list = list.filter((h) => selected.has(normalizeHolidayKind(h)));
    }
    const q = holidaySearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.description?.toLowerCase().includes(q) ?? false),
      );
    }
    return [...list].sort((a, b) => holidayIsoDate(a).localeCompare(holidayIsoDate(b)));
  }, [items, selectedKinds, holidaySearch]);

  const kindCounts = useMemo(() => {
    const counts: Record<HolidayKind, number> = { Public: 0, Mercantile: 0, Poya: 0, Restricted: 0 };
    for (const h of items) counts[normalizeHolidayKind(h)] += 1;
    return counts;
  }, [items]);

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
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title={`Company holidays — ${year}`}
        subtitle={
          <>
            {countryLabel} calendar · <span className="font-medium text-slate-700">{timeZoneId}</span>
            {countryCode === "LK"
              ? " · Statutory mercantile and Poya days are seeded automatically."
              : " · National public holidays are seeded automatically for this country."}
          </>
        }
        badge={
          <Button type="button" onClick={() => openAdd()} className="shrink-0">
            + Add holiday
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HOLIDAY_KINDS.map((kind) => {
          const styles = holidayKindStyles(kind);
          const active = selectedKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKindFilter(kind)}
              className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                active
                  ? `${styles.listBorder} bg-white ring-2 ring-inset ring-slate-200/80`
                  : "border-slate-200 bg-slate-50/80 opacity-70 hover:opacity-100"
              }`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${styles.listTitle}`}>{styles.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{kindCounts[kind]}</p>
              <p className="mt-0.5 text-xs text-slate-500">{active ? "Shown" : "Hidden"} · tap to toggle</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem]">
          <div>
            <label className={labelClass}>Search</label>
            <input
              type="search"
              value={holidaySearch}
              onChange={(e) => setHolidaySearch(sanitizeSearchInput(e.target.value))}
              placeholder="Holiday name or note…"
              className={inputClass + " w-full"}
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <FormSelect
              value={countryCode}
              onValueChange={(v) => { void handleCountryChange(v); }}
              options={countryOptions}
              className="w-full"
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
              className="w-full"
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
              className="w-full"
              clearable={false}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Show</span>
            {HOLIDAY_KINDS.map((kind) => {
              const styles = holidayKindStyles(kind);
              const on = selectedKinds.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleKindFilter(kind)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    on ? `${styles.chip}` : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {styles.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedKinds([...ALL_HOLIDAY_KINDS])}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              All types
            </button>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={() => setSelectedKinds([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              None
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            {filteredItems.length} holiday{filteredItems.length === 1 ? "" : "s"} in view
            {selectedKinds.length === 0 ? " — select a type above" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">View</span>
            <button
              type="button"
              onClick={() => setHolidaysView("calendar")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                holidaysView === "calendar"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setHolidaysView("list")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                holidaysView === "list"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : holidaysView === "calendar" ? (
          <div className="p-4 sm:p-5">
            <HolidaysCalendarPanel
              year={year}
              items={filteredItems}
              onSelectHoliday={openEdit}
              onAddForDate={openAdd}
            />
          </div>
        ) : (
          <div className="max-h-[min(70vh,40rem)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-xs">
              <thead className="bg-slate-50/90">
                <tr>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                    Holiday
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                    Date
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                    Type
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                    Note
                  </th>
                  <th
                    className="sticky top-0 z-10 w-20 border-b border-slate-200 bg-slate-50/95 py-2 pr-3 backdrop-blur"
                    aria-label="Actions"
                  />
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <p className="text-sm font-medium text-slate-700">No holidays match your filters</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedKinds.length === 0
                          ? "Turn on at least one holiday type."
                          : "Try another year, country, or search term."}
                      </p>
                    </td>
                  </tr>
                )}
                {filteredItems.map((h) => {
                  const kind = normalizeHolidayKind(h);
                  const styles = holidayKindStyles(kind);
                  return (
                    <tr key={h.id} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{h.name}</p>
                        <p className="text-[11px] text-slate-500">{fmtHolidayWeekday(h.date, timeZoneId)}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                        {fmtHolidayDateInZone(h.date, timeZoneId)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
                          {styles.label}
                        </span>
                      </td>
                      <td className="max-w-[12rem] px-3 py-2 text-slate-600">
                        <span className="line-clamp-2">{h.description?.trim() || "—"}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(h)}
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(h.id)}
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

const TEAM_LEAVE_TYPE_STYLES: Record<string, { chip: string; dot: string; label: string }> = {
  "Annual Leave": { chip: "bg-blue-100 text-blue-800", dot: "bg-blue-500", label: "Annual Leave" },
  "Casual Leave": { chip: "bg-teal-100 text-teal-800", dot: "bg-teal-500", label: "Casual Leave" },
  "Sick Leave": { chip: "bg-rose-100 text-rose-800", dot: "bg-rose-500", label: "Sick Leave" },
  "Maternity Leave": { chip: "bg-fuchsia-100 text-fuchsia-800", dot: "bg-fuchsia-500", label: "Maternity Leave" },
  "No-Pay Leave": { chip: "bg-slate-200 text-slate-700", dot: "bg-slate-500", label: "No-Pay Leave" },
};

const TEAM_CALENDAR_MAX_AVATARS = 6;

/** Distinct solid colors for calendar employee initials (stable per name). */
const TEAM_CALENDAR_AVATAR_COLORS = [
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-violet-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-cyan-500 text-white",
  "bg-fuchsia-500 text-white",
  "bg-indigo-500 text-white",
  "bg-orange-500 text-white",
  "bg-teal-500 text-white",
  "bg-pink-500 text-white",
  "bg-sky-500 text-white",
];

function teamCalendarAvatarColor(employeeName: string): string {
  const key = employeeName.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TEAM_CALENDAR_AVATAR_COLORS[hash % TEAM_CALENDAR_AVATAR_COLORS.length] ?? TEAM_CALENDAR_AVATAR_COLORS[0];
}

function TeamCalendarEmployeeAvatar({
  employeeName,
  profileImageUrl,
  leaveTypeName,
}: {
  employeeName: string;
  profileImageUrl?: string | null;
  leaveTypeName: string;
}) {
  const photoUrl = resolveAssetUrl(profileImageUrl ?? null);
  const initials = employeeInitials(employeeName);
  const colorClass = teamCalendarAvatarColor(employeeName);
  const [photoFailed, setPhotoFailed] = useState(false);

  if (photoUrl && !photoFailed) {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-white"
        title={`${employeeName} — ${leaveTypeName}`}
      >
        <img
          src={photoUrl}
          alt={employeeName}
          className="h-full w-full object-cover"
          onError={() => setPhotoFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none ${colorClass}`}
      title={`${employeeName} — ${leaveTypeName}`}
    >
      {initials}
    </span>
  );
}

function calendarDayFromIso(date: string): number {
  return parseInt(date.split("T")[0]?.slice(8, 10) ?? "0", 10);
}

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

  const selectedDepartmentLabel =
    departmentFilterOptions.find((o) => o.value === departmentFilterId)?.label ?? "All departments";

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
    ])
      .then(([cal, hol]) => {
        setDays(cal);
        setHolidays(hol.filter((h) => holidayMonthFromIso(h) === month));
      })
      .finally(() => setLoading(false));
  }, [month, year, countryCode, departmentFilterId]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = useMemo(() => new Map(days.map((d) => [calendarDayFromIso(d.date), d])), [days]);

  const holidayByDay = useMemo(() => {
    const map = new Map<number, HolidayItem[]>();
    for (const h of holidays) {
      const d = holidayDayFromIso(h);
      const list = map.get(d) ?? [];
      list.push(h);
      map.set(d, list);
    }
    return map;
  }, [holidays]);

  const monthStats = useMemo(() => {
    const employees = new Set<string>();
    let entryCount = 0;
    let busiestDay = 0;
    let busiestCount = 0;
    for (const d of days) {
      const count = d.entries.length;
      entryCount += count;
      for (const e of d.entries) employees.add(e.employeeName);
      if (count > busiestCount) {
        busiestCount = count;
        busiestDay = calendarDayFromIso(d.date);
      }
    }
    return {
      peopleOnLeave: employees.size,
      leaveEntries: entryCount,
      busyDays: days.filter((d) => d.entries.length > 0).length,
      holidays: holidays.length,
      busiestDay,
      busiestCount,
    };
  }, [days, holidays]);

  function goToToday() {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function isoForDay(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title={`Team calendar — ${MONTH_NAMES[month - 1]} ${year}`}
        subtitle={
          <>
            Approved leave and public holidays for <span className="font-medium text-slate-700">{selectedDepartmentLabel}</span>.
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">People on leave</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{loading ? "—" : monthStats.peopleOnLeave}</p>
          <p className="mt-0.5 text-xs text-slate-500">Unique this month</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Leave days</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">{loading ? "—" : monthStats.busyDays}</p>
          <p className="mt-0.5 text-xs text-slate-500">Days with at least one person away</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Holidays</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{loading ? "—" : monthStats.holidays}</p>
          <p className="mt-0.5 text-xs text-slate-500">In {MONTH_NAMES[month - 1]}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Busiest day</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {loading ? "—" : monthStats.busiestCount > 0 ? monthStats.busiestDay : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {monthStats.busiestCount > 0 ? `${monthStats.busiestCount} away` : "No leave booked"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label className={labelClass}>Department</label>
            <FormSelect
              value={departmentFilterId}
              onValueChange={setDepartmentFilterId}
              options={departmentFilterOptions}
              className="w-full"
              clearable={false}
            />
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Jump to today
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/50">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white via-sky-50/20 to-emerald-50/20 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                ← Prev
              </button>
              <div className="text-center">
                <p className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Approved leave only</p>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Next →
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid shrink-0 grid-cols-7 border-b border-slate-100 bg-slate-50/80">
                {DAY_NAMES_SHORT.map((dn) => (
                  <div key={dn} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {dn}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="min-h-[5.5rem] border-b border-r border-slate-100 bg-slate-50/40" />;
                  }

                  const iso = isoForDay(day);
                  const calDay = dayMap.get(day);
                  const dayHolidays = holidayByDay.get(day) ?? [];
                  const entryCount = calDay?.entries.length ?? 0;
                  const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
                  const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                  return (
                    <div
                      key={iso}
                      className={`min-h-[5.5rem] border-b border-r border-slate-100 p-1.5 ${
                        isWeekend ? "bg-slate-50/30" : "bg-white"
                      }`}
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
                          {dayHolidays.slice(0, 1).map((holiday) => {
                            const chip = holidayKindStyles(normalizeHolidayKind(holiday)).chip;
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
                        </div>
                      ) : null}
                      {entryCount > 0 ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                          {calDay?.entries.slice(0, TEAM_CALENDAR_MAX_AVATARS).map((entry, ei) => (
                              <TeamCalendarEmployeeAvatar
                                key={`${entry.employeeName}-${ei}`}
                                employeeName={entry.employeeName}
                                profileImageUrl={entry.profileImageUrl}
                                leaveTypeName={entry.leaveTypeName}
                              />
                          ))}
                          {entryCount > TEAM_CALENDAR_MAX_AVATARS ? (
                            <span
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-1 text-[9px] font-bold text-slate-600"
                              title={`${entryCount - TEAM_CALENDAR_MAX_AVATARS} more on leave`}
                            >
                              +{entryCount - TEAM_CALENDAR_MAX_AVATARS}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Leave types</span>
                {Object.values(TEAM_LEAVE_TYPE_STYLES).map((style) => (
                  <span
                    key={style.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.chip}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                    {style.label}
                  </span>
                ))}
                <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Holidays</span>
                {HOLIDAY_KINDS.map((kind) => {
                  const styles = holidayKindStyles(kind);
                  return (
                    <span
                      key={kind}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.legendChip}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${styles.legendDot}`} aria-hidden />
                      {styles.label}
                    </span>
                  );
                })}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
