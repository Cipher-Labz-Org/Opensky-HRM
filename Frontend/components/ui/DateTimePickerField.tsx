"use client";

import * as React from "react";
import { DatePickerField } from "./DatePickerField";
import { joinDateTime, splitDateTime } from "@/lib/datePickerIso";

const timeInputClass =
  "w-[8.5rem] shrink-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50";

export type DateTimePickerFieldProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (isoLocal: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Applied to the outer row (date + time). */
  rowClassName?: string;
};

export function DateTimePickerField({
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
  rowClassName = "",
}: DateTimePickerFieldProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const full = isControlled ? (valueProp ?? "") : internal;

  React.useEffect(() => {
    if (!isControlled) setInternal(defaultValue);
  }, [defaultValue, isControlled]);

  const setFull = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const { date: datePart, time: timePart } = splitDateTime(full);

  const setDate = React.useCallback(
    (isoDate: string) => {
      setFull(joinDateTime(isoDate, timePart));
    },
    [setFull, timePart],
  );

  const setTime = React.useCallback(
    (t: string) => {
      setFull(joinDateTime(datePart, t));
    },
    [setFull, datePart],
  );

  return (
    <div className={`flex min-w-0 flex-wrap items-stretch gap-2 ${rowClassName}`}>
      {name != null ? (
        <input type="hidden" name={name} value={full} required={required} />
      ) : null}
      <DatePickerField
        id={id}
        value={datePart}
        onChange={setDate}
        min={min}
        max={max}
        disabled={disabled}
        placeholder="Date"
        className={`min-w-0 flex-1 ${className}`.trim()}
      />
      <input
        type="time"
        value={timePart}
        onChange={(e) => setTime(e.target.value)}
        disabled={disabled}
        className={timeInputClass}
        aria-label="Time"
      />
    </div>
  );
}
