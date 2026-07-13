"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormSelectOption } from "./FormSelect";
import { sanitizeSearchInput } from "@/lib/input-validation";

const MAX_SUGGESTIONS = 12;

export function OptionsAutocompleteInput({
  value,
  onChange,
  options,
  className = "",
  placeholder = "Type to search…",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    const match = options.find((o) => o.value === value);
    setInputText(match?.label ?? "");
  }, [value, options]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = inputText.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [inputText, options]);

  function onInputChange(next: string) {
    const sanitized = sanitizeSearchInput(next);
    setInputText(sanitized);
    setOpen(true);
    const exact = options.find((o) => o.label.toLowerCase() === sanitized.trim().toLowerCase());
    onChange(exact?.value ?? "");
  }

  function pickOption(option: FormSelectOption) {
    setInputText(option.label);
    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[10060] mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  option.value === value ? "bg-blue-50 font-medium text-blue-800" : "text-slate-800"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickOption(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
