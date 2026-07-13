"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

function parseTime24(value: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return { hour12: 12, minute: 0, period: "AM" };
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return { hour12: h12, minute, period };
}

function toTime24(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeDisplay(value: string): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";
  const { hour12, minute, period } = parseTime24(value);
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function buildMinuteOptions(step: number): number[] {
  const safe = Math.max(1, Math.min(60, step));
  const out: number[] = [];
  for (let m = 0; m < 60; m += safe) out.push(m);
  return out;
}

function isTimeAllowed(
  time24: string,
  hourStart: number,
  hourEnd: number,
  minTime?: string,
): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(time24);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < hourStart) return false;
  if (h > hourEnd || (h === hourEnd && min > 0)) return false;
  if (minTime && /^\d{2}:\d{2}$/.test(minTime) && time24 < minTime) return false;
  return true;
}

const columnBtn =
  "w-full rounded-lg px-2 py-1.5 text-center text-sm text-slate-700 transition hover:bg-[var(--primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

const columnBtnSelected =
  "bg-[var(--primary-soft)] font-semibold text-[var(--primary-deep)]";

export type TimePickerFieldProps = {
  id?: string;
  value?: string;
  onChange?: (time24: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Minute increments (default 1). Use 15 for interview scheduling. */
  minuteStep?: number;
  /** Earliest hour in 24h format (default 0). */
  hourStart?: number;
  /** Latest hour in 24h format (default 23). */
  hourEnd?: number;
  /** Earliest allowed time on the selected day (HH:mm). */
  minTime?: string;
};

export function TimePickerField({
  id,
  value = "",
  onChange,
  disabled,
  className = "",
  placeholder = "Select time",
  minuteStep = 1,
  hourStart = 0,
  hourEnd = 23,
  minTime,
}: TimePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseTime24(value);
  const display = value ? formatTimeDisplay(value) : placeholder;
  const minutes = React.useMemo(() => buildMinuteOptions(minuteStep), [minuteStep]);
  const hourColRef = React.useRef<HTMLDivElement>(null);
  const minuteColRef = React.useRef<HTMLDivElement>(null);
  const periodColRef = React.useRef<HTMLDivElement>(null);

  const setParts = (hour12: number, minute: number, period: "AM" | "PM") => {
    onChange?.(toTime24(hour12, minute, period));
  };

  const scrollSelectedIntoView = React.useCallback((col: HTMLDivElement | null) => {
    if (!col) return;
    const selected = col.querySelector('[data-selected="true"]');
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: "center" });
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      scrollSelectedIntoView(hourColRef.current);
      scrollSelectedIntoView(minuteColRef.current);
      scrollSelectedIntoView(periodColRef.current);
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, parsed.hour12, parsed.minute, parsed.period, scrollSelectedIntoView]);

  const triggerClass =
    "flex w-full min-w-[8.5rem] cursor-pointer select-none appearance-none items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-left text-sm font-normal text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50 " +
    (!value ? "text-slate-400 " : "") +
    className;

  const scrollCol = (
    colRef: React.Ref<HTMLDivElement>,
    selected: number | string,
    options: Array<number | string>,
    onSelect: (n: number | string) => void,
    format: (n: number | string) => string,
    isOptionAllowed: (n: number | string) => boolean,
  ) => (
    <div
      ref={colRef}
      className="opensky-time-picker__col max-h-52 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/50 p-1"
    >
      {options.map((n) => {
        const allowed = isOptionAllowed(n);
        const isSelected = selected === n;
        return (
          <button
            key={String(n)}
            type="button"
            data-selected={isSelected ? "true" : undefined}
            disabled={!allowed}
            className={`${columnBtn} ${isSelected ? columnBtnSelected : ""}`}
            onClick={() => allowed && onSelect(n)}
          >
            {format(n)}
          </button>
        );
      })}
    </div>
  );

  const hourAllowed = (hour12: number) =>
    (["AM", "PM"] as const).some((period) =>
      minutes.some((minute) => isTimeAllowed(toTime24(hour12, minute, period), hourStart, hourEnd, minTime)),
    );

  const minuteAllowed = (minute: number) =>
    isTimeAllowed(toTime24(parsed.hour12, minute, parsed.period), hourStart, hourEnd, minTime);

  const periodAllowed = (period: "AM" | "PM") =>
    minutes.some((minute) => isTimeAllowed(toTime24(parsed.hour12, minute, period), hourStart, hourEnd, minTime));

  return (
    <div className="relative w-full min-w-0 shrink-0">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={triggerClass}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span className="min-w-0 truncate">{display}</span>
            <ClockIcon className="shrink-0 text-slate-500" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-[10050] w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-white p-3 shadow-lg outline-none"
            sideOffset={6}
            align="end"
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="opensky-time-picker flex gap-2">
              {scrollCol(
                hourColRef,
                parsed.hour12,
                HOURS_12,
                (h) => setParts(Number(h), parsed.minute, parsed.period),
                (n) => String(n).padStart(2, "0"),
                (n) => hourAllowed(Number(n)),
              )}
              {scrollCol(
                minuteColRef,
                parsed.minute,
                minutes,
                (m) => setParts(parsed.hour12, Number(m), parsed.period),
                (n) => String(n).padStart(2, "0"),
                (n) => minuteAllowed(Number(n)),
              )}
              <div
                ref={periodColRef}
                className="opensky-time-picker__col max-h-52 w-14 shrink-0 overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/50 p-1"
              >
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-selected={parsed.period === p ? "true" : undefined}
                    disabled={!periodAllowed(p)}
                    className={`${columnBtn} ${parsed.period === p ? columnBtnSelected : ""}`}
                    onClick={() => periodAllowed(p) && setParts(parsed.hour12, parsed.minute, p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                className="text-xs font-semibold text-[var(--primary)] hover:underline"
                onClick={() => {
                  onChange?.("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-[var(--primary)] hover:underline"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
