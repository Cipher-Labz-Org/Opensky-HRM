"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

const EMPTY = "__opensky_select_empty__";

export type FormSelectOption = { value: string; label: string };

export type FormSelectProps = {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

const triggerClass =
  "flex h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-left text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-300 hover:shadow " +
  "focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 focus:ring-[3px] focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "[&[data-placeholder]]:text-slate-400";

const contentClass =
  "z-[10050] max-h-[min(280px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/60";

const itemClass =
  "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-slate-700 outline-none " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40 " +
  "data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900 " +
  "data-[state=checked]:bg-indigo-50/80 data-[state=checked]:font-semibold data-[state=checked]:text-indigo-900";

const chevron = (
  <SelectPrimitive.Icon className="shrink-0 text-indigo-500">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  </SelectPrimitive.Icon>
);

export function FormSelect({
  id,
  name,
  defaultValue = "",
  value: valueProp,
  onValueChange,
  options,
  placeholder = "— Select —",
  required,
  disabled,
  className = "",
}: FormSelectProps) {
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const formValue = isControlled ? (valueProp ?? "") : internal;

  React.useEffect(() => {
    if (!isControlled) setInternal(defaultValue);
  }, [defaultValue, isControlled]);

  const setFormValue = (v: string) => {
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const items = React.useMemo(
    () =>
      options.map((o) => ({
        radixValue: o.value === "" ? EMPTY : o.value,
        label: o.label,
      })),
    [options],
  );

  const radixValue = formValue === "" ? undefined : formValue;

  const onRadixChange = (rv: string) => {
    setFormValue(rv === EMPTY ? "" : rv);
  };

  return (
    <SelectPrimitive.Root value={radixValue} onValueChange={onRadixChange} disabled={disabled}>
      {name != null ? <input type="hidden" name={name} value={formValue} required={required} /> : null}
      <SelectPrimitive.Trigger id={id} className={`${triggerClass} ${className}`.trim()}>
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
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
            {items.map((row) => (
              <SelectPrimitive.Item key={row.radixValue} value={row.radixValue} className={itemClass}>
                <SelectPrimitive.ItemText>{row.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
