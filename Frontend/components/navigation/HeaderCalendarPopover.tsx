"use client";

import * as React from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { apiFetch } from "@/lib/api";
import { ROUTES } from "@/config/routes";

type CalendarDay = {
  date: string;
  entries: { employeeName: string; leaveTypeName: string; status: string }[];
};

type HolidayItem = {
  date: string;
  name: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function holidayDayFromIso(h: HolidayItem): number {
  const iso = h.date.split("T")[0] ?? h.date;
  return parseInt(iso.slice(8, 10), 10);
}

function holidayMonthFromIso(h: HolidayItem): number {
  const iso = h.date.split("T")[0] ?? h.date;
  return parseInt(iso.slice(5, 7), 10);
}

type HeaderCalendarPopoverProps = {
  iconBtnClass: string;
  iconStroke?: number;
};

export function HeaderCalendarPopover({ iconBtnClass, iconStroke = 1.75 }: HeaderCalendarPopoverProps) {
  const now = new Date();
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());
  const [days, setDays] = React.useState<CalendarDay[]>([]);
  const [holidays, setHolidays] = React.useState<HolidayItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      apiFetch<CalendarDay[]>(`/api/leave/calendar?month=${month}&year=${year}`).catch(() => [] as CalendarDay[]),
      apiFetch<HolidayItem[]>(`/api/leave/holidays?year=${year}&country=LK`).catch(() => [] as HolidayItem[]),
    ])
      .then(([cal, hol]) => {
        setDays(Array.isArray(cal) ? cal : []);
        setHolidays(
          (Array.isArray(hol) ? hol : []).filter((h) => holidayMonthFromIso(h) === month),
        );
      })
      .finally(() => setLoading(false));
  }, [open, month, year]);

  React.useEffect(() => {
    setSelectedDay(null);
  }, [month, year]);

  const dayMap = React.useMemo(
    () => new Map(days.map((d) => [new Date(d.date).getDate(), d])),
    [days],
  );
  const holidayMap = React.useMemo(
    () => new Map(holidays.map((h) => [holidayDayFromIso(h), h])),
    [holidays],
  );

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedEntries =
    selectedDay != null ? dayMap.get(selectedDay)?.entries ?? [] : [];
  const selectedHoliday = selectedDay != null ? holidayMap.get(selectedDay) : null;

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setSelectedDay(now.getDate());
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={iconBtnClass} title="Calendar" aria-label="Calendar">
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[10050] w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-200/90 bg-white p-0 shadow-lg shadow-slate-900/10 outline-none"
          sideOffset={8}
          align="end"
          collisionPadding={12}
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-800">Calendar</p>
            <p className="text-[11px] text-slate-500">
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Previous month"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
                <button
                  type="button"
                  onClick={goToday}
                  className="text-[11px] font-medium text-[#1a92d5] hover:underline"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Next month"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {DAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase text-slate-400">
                  {label}
                </div>
              ))}
              {cells.map((day, idx) => {
                if (day == null) {
                  return <div key={`empty-${idx}`} className="h-9" aria-hidden />;
                }
                const isToday =
                  day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
                const hasLeave = (dayMap.get(day)?.entries.length ?? 0) > 0;
                const hasHoliday = holidayMap.has(day);
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? "bg-[#1a92d5] text-white"
                        : isToday
                          ? "bg-sky-50 text-[#1a92d5] ring-1 ring-[#1a92d5]/40"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {day}
                    {(hasLeave || hasHoliday) && (
                      <span className="absolute bottom-1 flex gap-0.5">
                        {hasLeave ? (
                          <span
                            className={`h-1 w-1 rounded-full ${isSelected ? "bg-white/90" : "bg-amber-400"}`}
                            aria-hidden
                          />
                        ) : null}
                        {hasHoliday ? (
                          <span
                            className={`h-1 w-1 rounded-full ${isSelected ? "bg-white/70" : "bg-emerald-500"}`}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <p className="mt-3 text-center text-xs text-slate-400">Loading…</p>
            ) : selectedDay != null ? (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-slate-600">
                  {selectedDay} {MONTH_NAMES[month - 1]}
                </p>
                {selectedHoliday ? (
                  <p className="mt-1 text-xs text-emerald-700">{selectedHoliday.name}</p>
                ) : null}
                {selectedEntries.length === 0 ? (
                  !selectedHoliday ? (
                    <p className="mt-1 text-xs text-slate-500">No leave on this day.</p>
                  ) : null
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {selectedEntries.map((entry, i) => (
                      <li key={i} className="text-xs text-slate-700">
                        <span className="font-medium">{entry.employeeName}</span>
                        <span className="text-slate-500"> · {entry.leaveTypeName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="mt-3 text-center text-[11px] text-slate-400">Select a day to see leave and holidays.</p>
            )}
          </div>

          <div className="flex border-t border-slate-100">
            <Link
              href={ROUTES.leave}
              className="flex-1 px-3 py-2.5 text-center text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#1a92d5]"
              onClick={() => setOpen(false)}
            >
              Leave module
            </Link>
            <Link
              href={`${ROUTES.leave}?tab=calendar`}
              className="flex-1 border-l border-slate-100 px-3 py-2.5 text-center text-xs font-semibold text-[#1a92d5] transition hover:bg-sky-50"
              onClick={() => setOpen(false)}
            >
              Team calendar
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
