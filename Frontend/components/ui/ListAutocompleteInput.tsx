"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sanitizeSearchInput } from "@/lib/input-validation";

const DEFAULT_MAX_SUGGESTIONS = 12;

export function ListAutocompleteInput({
  name,
  value,
  onChange,
  options,
  className = "",
  placeholder = "Type to search…",
  disabled = false,
  showAllOnFocus = false,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** When true, focus shows the full option list; typing still filters and custom values are allowed. */
  showAllOnFocus?: boolean;
  /** Max items in the dropdown. Use a large number (e.g. 200) with showAllOnFocus for full catalogs. */
  maxSuggestions?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value);

  useEffect(() => {
    setInputText(value);
  }, [value]);

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
      ? options.filter((item) => item.toLowerCase().includes(q))
      : showAllOnFocus
        ? options
        : [];
    return filtered.slice(0, maxSuggestions);
  }, [inputText, options, showAllOnFocus, maxSuggestions]);

  function onInputChange(next: string) {
    const sanitized = sanitizeSearchInput(next);
    setInputText(sanitized);
    onChange(sanitized);
    setOpen(showAllOnFocus ? options.length > 0 : sanitized.trim().length > 0);
  }

  function pickItem(item: string) {
    setInputText(item);
    onChange(item);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        id={inputId}
        type="text"
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          if (showAllOnFocus && options.length > 0) {
            setOpen(true);
            return;
          }
          if (inputText.trim().length > 0 && suggestions.length > 0) setOpen(true);
        }}
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
          {suggestions.map((item) => (
            <li key={item} role="presentation">
              <button
                type="button"
                role="option"
                className="flex w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickItem(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
