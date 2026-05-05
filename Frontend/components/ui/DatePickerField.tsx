"use client";

import * as React from "react";
import "react-day-picker/style.css";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { DayPicker, type Matcher } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { formatLocalDateToIso, parseIsoDateToLocal } from "@/lib/datePickerIso";
import { DayPickerDropdown } from "./DayPickerDropdown";

function CalendarIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export type DatePickerFieldProps = {
  id?: string;
  /** When set, a hidden input is rendered for native form posts. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (isoDate: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Shown when no date is selected. */
  placeholder?: string;
};

export function DatePickerField({
  id,
  name,
  value: valueProp,
  defaultValue = "",
  onChange,
  min,
  max,
  disabled,
  required,
  className = "",
  placeholder = "Select date",
}: DatePickerFieldProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const value = isControlled ? (valueProp ?? "") : internal;

  React.useEffect(() => {
    if (!isControlled) setInternal(defaultValue);
  }, [defaultValue, isControlled]);

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const [open, setOpen] = React.useState(false);

  const selected = parseIsoDateToLocal(value);
  const minD = min ? parseIsoDateToLocal(min) : undefined;
  const maxD = max ? parseIsoDateToLocal(max) : undefined;

  const now = new Date();
  const currentYear = now.getFullYear();
  const startMonth = minD ?? new Date(currentYear - 100, 0, 1);
  const endMonth = maxD ?? new Date(currentYear + 15, 11, 31);

  const display =
    selected != null
      ? format(selected, "dd MMM yyyy", { locale: enGB })
      : placeholder;

  const disabledMatchers: Matcher | Matcher[] | undefined =
    minD || maxD
      ? [
          ...(minD ? [{ before: minD } as const] : []),
          ...(maxD ? [{ after: maxD } as const] : []),
        ]
      : undefined;

  const defaultMonth = selected ?? now;

  const triggerClass =
    "flex w-full cursor-pointer select-none appearance-none items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-left text-sm font-normal text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50 " +
    (selected == null ? "text-slate-400 " : "") +
    className;

  return (
    <div className="relative w-full min-w-0">
      {name != null ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
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
            <CalendarIcon className="shrink-0 text-slate-500" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-[10050] min-w-[17rem] rounded-2xl border border-[var(--border)] bg-white p-3 shadow-lg outline-none"
            sideOffset={6}
            align="start"
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DayPicker
              key={value || "empty"}
              mode="single"
              selected={selected}
              onSelect={(d) => {
                setValue(d ? formatLocalDateToIso(d) : "");
                setOpen(false);
              }}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              defaultMonth={defaultMonth}
              disabled={disabledMatchers}
              locale={enGB}
              className="opensky-day-picker"
              components={{ Dropdown: DayPickerDropdown }}
            />
            <div className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                className="text-xs font-semibold text-orange-600 hover:underline"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-orange-600 hover:underline"
                onClick={() => {
                  setValue(formatLocalDateToIso(new Date()));
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
