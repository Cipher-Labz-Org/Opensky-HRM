"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { UI, type ClassNames, type CustomComponents } from "react-day-picker";

type DropdownOption = { value: number; label: string; disabled?: boolean };

function pickerNumericValue(
  v: string | number | readonly string[] | undefined,
): number | undefined {
  if (v === undefined || v === "") return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return undefined;
}

/** Props passed by react-day-picker's internal `Dropdown` to `components.Dropdown`. */
export type DayPickerDropdownProps = {
  options?: DropdownOption[];
  classNames: ClassNames;
  components: CustomComponents;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children">;

const triggerBase =
  "flex h-9 shrink-0 items-center justify-between gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-300 hover:shadow " +
  "focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 focus:ring-[3px] focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "data-[state=open]:border-indigo-400 data-[state=open]:shadow-md data-[state=open]:ring-2 data-[state=open]:ring-indigo-500/15";

const contentClass =
  "z-[10060] max-h-[min(280px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/60";

const itemClass =
  "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-slate-700 outline-none " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40 " +
  "data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900 " +
  "data-[state=checked]:bg-indigo-50/80 data-[state=checked]:font-semibold data-[state=checked]:text-indigo-900";

const chevron = (
  <SelectPrimitive.Icon className="shrink-0 text-indigo-500" aria-hidden>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </SelectPrimitive.Icon>
);

/**
 * Radix-based month/year control for DayPicker — matches FormSelect styling and
 * keeps the menu anchored in-app (no native OS list over the rest of the form).
 */
export function DayPickerDropdown({
  options = [],
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  className,
  classNames,
  components: _components,
  style,
}: DayPickerDropdownProps) {
  const numericValue = pickerNumericValue(value);
  const selected = numericValue !== undefined ? options.find((o) => o.value === numericValue) : undefined;
  const strVal =
    numericValue !== undefined && options.some((o) => o.value === numericValue && !o.disabled)
      ? String(numericValue)
      : undefined;

  const handleValue = (v: string) => {
    onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>);
  };

  const isYear = className?.includes("years_dropdown");
  const triggerClass = `${triggerBase} ${isYear ? "min-w-[5.5rem]" : "min-w-[8.25rem]"}`.trim();

  const rootClass = [classNames[UI.DropdownRoot], className, "inline-flex items-center"].filter(Boolean).join(" ");

  return (
    <span data-disabled={disabled ? true : undefined} className={rootClass} style={style}>
      <SelectPrimitive.Root value={strVal} onValueChange={handleValue} disabled={disabled}>
        <SelectPrimitive.Trigger className={triggerClass} aria-label={ariaLabel}>
          <SelectPrimitive.Value placeholder="—">{selected?.label}</SelectPrimitive.Value>
          {chevron}
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={contentClass}
            position="popper"
            side="bottom"
            sideOffset={6}
            align="start"
            collisionPadding={12}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item key={o.value} value={String(o.value)} disabled={o.disabled} className={itemClass}>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}
