"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

const EMPTY = "__opensky_select_empty__";

export type FormSelectOption = { value: string; label: string };

/** `slate` = Approvals-style: compact radius, neutral border, gray hover + white text in list. */
export type FormSelectTone = "blue" | "slate";

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
  /** Show an × control to clear the current selection. Default: true */
  clearable?: boolean;
  className?: string;
  tone?: FormSelectTone;
};

const triggerBlue =
  "flex h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-2 pl-3.5 pr-5 text-left text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-300 hover:shadow " +
  "focus:border-[#2E7BBF] focus:shadow-md focus:shadow-[#2E7BBF]/10 focus:ring-[3px] focus:ring-[#2E7BBF]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "[&[data-placeholder]]:text-slate-400";

const triggerSlate =
  "flex h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white py-2 pl-3.5 pr-5 text-left text-sm font-normal text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-400 hover:shadow " +
  "focus:border-slate-400 focus:shadow-md focus:ring-[3px] focus:ring-slate-400/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "[&[data-placeholder]]:text-slate-500";

const contentClass =
  "opensky-select-panel z-[10050] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden";

const itemClass =
  "opensky-select-option relative flex w-full cursor-pointer select-none items-center rounded-[7px] py-2 pl-2.5 pr-2 text-left text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

function Chevron({ tone }: { tone: FormSelectTone }) {
  const cls = tone === "slate" ? "shrink-0 text-slate-600" : "shrink-0 text-[#2E7BBF]";
  return (
    <SelectPrimitive.Icon asChild>
      <span className={`${cls} inline-flex items-center justify-center pr-0.5`} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </SelectPrimitive.Icon>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      aria-label="Clear selection"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

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
  clearable = true,
  className = "",
  tone = "blue",
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

  const hasEmptyOption = options.some((o) => o.value === "");
  const emptyOptionLabel = options.find((o) => o.value === "")?.label ?? placeholder;
  const radixValue = formValue === "" ? EMPTY : formValue;

  const onRadixChange = (rv: string) => {
    setFormValue(rv === EMPTY ? "" : rv);
  };

  const clearSelection = () => setFormValue("");

  const triggerClass = tone === "slate" ? triggerSlate : triggerBlue;
  const sideOffset = 6;
  const placeholderClass = tone === "slate" ? "text-slate-500" : "text-slate-400";

  return (
    <SelectPrimitive.Root value={radixValue} onValueChange={onRadixChange} disabled={disabled}>
      {name != null ? <input type="hidden" name={name} value={formValue} required={required} /> : null}
      <SelectPrimitive.Trigger id={id} className={`${triggerClass} ${className}`.trim()}>
        <span className="min-w-0 flex-1 truncate text-left">
          {formValue === "" ? (
            <span className={placeholderClass}>{emptyOptionLabel}</span>
          ) : (
            <SelectPrimitive.Value placeholder={placeholder} />
          )}
        </span>
        {clearable && formValue !== "" && !disabled ? <ClearButton onClear={clearSelection} /> : null}
        <Chevron tone={tone} />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={contentClass}
          position="popper"
          side="bottom"
          sideOffset={sideOffset}
          align="start"
          collisionPadding={12}
        >
          <SelectPrimitive.Viewport className="max-h-[min(300px,var(--radix-select-content-available-height))] overflow-y-auto p-1">
            {hasEmptyOption ? (
              <SelectPrimitive.Item value={EMPTY} className={itemClass}>
                <SelectPrimitive.ItemText>{emptyOptionLabel}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ) : null}
            {items
              .filter((row) => row.radixValue !== EMPTY)
              .map((row) => (
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
