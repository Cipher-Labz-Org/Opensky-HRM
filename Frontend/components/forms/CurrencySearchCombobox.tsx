"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  CURRENCY_TYPE_OPTIONS,
  filterCurrencies,
  formatCurrencyLabel,
  getCurrencyByCode,
  type CurrencyType,
} from "@/lib/currencies";

const triggerClass =
  "flex h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-2 pl-3.5 pr-3 text-left text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-300 hover:shadow " +
  "focus:border-[#2E7BBF] focus:shadow-md focus:shadow-[#2E7BBF]/10 focus:ring-[3px] focus:ring-[#2E7BBF]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const regionTriggerClass =
  "flex h-[38px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-2 pl-3 pr-3 text-left text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 " +
  "hover:border-slate-300 hover:shadow " +
  "focus:border-[#2E7BBF] focus:shadow-md focus:shadow-[#2E7BBF]/10 focus:ring-[3px] focus:ring-[#2E7BBF]/20";

const regionContentClass =
  "z-[10051] max-h-[min(240px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/60";

const regionItemClass =
  "relative flex cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-8 text-sm text-slate-700 outline-none " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40 " +
  "data-[highlighted]:bg-[#e3eef8] data-[highlighted]:text-[#1a5f94] " +
  "data-[state=checked]:bg-[#e3eef8]/90 data-[state=checked]:font-semibold data-[state=checked]:text-[#1a5f94]";

const searchInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none " +
  "focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";

type TypeFilter = CurrencyType | "all";

function RegionFilterSelect({
  value,
  onValueChange,
}: {
  value: TypeFilter;
  onValueChange: (value: TypeFilter) => void;
}) {
  const options = CURRENCY_TYPE_OPTIONS;

  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as TypeFilter)}>
      <SelectPrimitive.Trigger className={regionTriggerClass} aria-label="Filter by region">
        <span className="min-w-0 flex-1 truncate text-left">
          <SelectPrimitive.Value placeholder="All regions" />
        </span>
        <SelectPrimitive.Icon asChild>
          <span className="shrink-0 text-[#2E7BBF]" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Content
        className={regionContentClass}
        position="popper"
        side="bottom"
        sideOffset={4}
        align="start"
        collisionPadding={8}
      >
        <SelectPrimitive.Viewport className="p-1">
          {options.map((opt) => (
            <SelectPrimitive.Item key={opt.value} value={opt.value} className={regionItemClass}>
              <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Root>
  );
}

export function CurrencySearchCombobox({
  value,
  onValueChange,
  placeholder = "Search currency code or name…",
  disabled = false,
  className = "",
}: {
  value: string;
  onValueChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const selected = getCurrencyByCode(value);

  const filtered = useMemo(
    () => filterCurrencies(query, typeFilter),
    [query, typeFilter]
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  const displayLabel = selected ? formatCurrencyLabel(selected) : placeholder;

  return (
    <div ref={wrapRef} className={`relative ${className}`.trim()}>
      <div className={`${triggerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <button
          type="button"
          disabled={disabled}
          className="min-w-0 flex-1 truncate text-left outline-none"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <span className={selected ? "" : "text-slate-400"}>{displayLabel}</span>
        </button>
        {selected && !disabled ? (
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
            className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear currency"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          className="shrink-0 text-[#2E7BBF] outline-none"
          aria-label="Open currency list"
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div
          className="absolute left-0 right-0 z-[10050] mt-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/60"
        >
          <div className="space-y-2 border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className={searchInputClass}
              aria-label="Search currencies"
            />
            <RegionFilterSelect value={typeFilter} onValueChange={setTypeFilter} />
          </div>
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-500">No currencies match your search.</li>
            ) : (
              filtered.map((currency) => {
                const isSelected = currency.code === value;
                return (
                  <li key={currency.code} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition ${
                        isSelected
                          ? "bg-[#e3eef8] font-semibold text-[#1a5f94]"
                          : "text-slate-700 hover:bg-[#e3eef8] hover:text-[#1a5f94]"
                      }`}
                      onClick={() => {
                        onValueChange(currency.code);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{currency.code}</span>
                        <span className="text-slate-500"> — {currency.name}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {currency.type}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
