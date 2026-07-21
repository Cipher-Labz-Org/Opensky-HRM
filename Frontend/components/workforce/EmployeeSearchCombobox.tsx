"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { sanitizeSearchInput } from "@/lib/input-validation";

export type EmployeeSearchPick = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  employeeCode?: string;
};

interface Hit {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentName?: string | null;
}

function formatLabel(e: Pick<EmployeeSearchPick, "firstName" | "lastName" | "employeeCode">) {
  const code = e.employeeCode?.trim();
  return `${e.firstName} ${e.lastName}${code ? ` (${code})` : ""}`;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-10 text-sm text-slate-700 outline-none transition " +
  "focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Type-ahead employee lookup (GET /api/employees?search=…), same interaction pattern as
 * “Coverage person” on Apply Leave — pick a row to set a stable employee id for the parent.
 */
export function EmployeeSearchCombobox({
  value,
  onPick,
  placeholder = "Type name or employee code…",
  className = "",
  disabled = false,
  departmentId,
  excludeEmployeeIds,
}: {
  value: string;
  onPick: (emp: EmployeeSearchPick | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** When set, suggestions are limited to this department. */
  departmentId?: string;
  /** Employee ids to omit from suggestions (e.g. self or already assigned). */
  excludeEmployeeIds?: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputId = useId();
  const listId = useId();

  const [inputText, setInputText] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    apiFetch<EmployeeSearchPick>(`/api/employees/${value}`)
      .then((e) => {
        if (cancelled) return;
        setInputText(formatLabel(e));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length === 0) {
      setHits([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "14", excludeTerminated: "true", search: q });
      if (departmentId) params.set("departmentId", departmentId);
      const res = await apiFetch<{ items: Hit[] }>(`/api/employees?${params}`);
      const excluded = new Set((excludeEmployeeIds ?? []).map((employeeId) => employeeId.trim().toLowerCase()));
      const items = (res.items ?? []).filter((hit) => !excluded.has(hit.id.trim().toLowerCase()));
      setHits(items);
      setOpen(items.length > 0);
    } catch {
      setHits([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [departmentId, excludeEmployeeIds]);

  function onInputChange(next: string) {
    const sanitized = sanitizeSearchInput(next);
    setInputText(sanitized);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = sanitized.trim();
    if (t.length === 0) {
      setHits([]);
      setOpen(false);
      if (value) onPick(null);
      return;
    }
    if (value) onPick(null);
    debounceRef.current = setTimeout(() => void runSearch(sanitized), 280);
  }

  async function chooseHit(hit: Hit) {
    setOpen(false);
    setHits([]);
    try {
      const e = await apiFetch<EmployeeSearchPick>(`/api/employees/${hit.id}`);
      setInputText(formatLabel(e));
      onPick(e);
    } catch {
      const parts = hit.fullName.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ") || firstName;
      const fallback: EmployeeSearchPick = {
        id: hit.id,
        firstName,
        lastName,
        profileImageUrl: null,
        employeeCode: hit.employeeCode,
      };
      setInputText(
        hit.employeeCode?.trim() ? `${hit.fullName.trim()} (${hit.employeeCode.trim()})` : hit.fullName.trim(),
      );
      onPick(fallback);
    }
  }

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <label htmlFor={inputId} className="sr-only">
        Employee
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          disabled={disabled}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (inputText.trim().length > 0) void runSearch(inputText.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          className={inputClass}
          placeholder={placeholder}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        {loading && (
          <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
            …
          </span>
        )}
      </div>
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {hits.map((hit) => (
            <li key={hit.id} role="presentation">
              <button
                type="button"
                role="option"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-[#e3eef8]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void chooseHit(hit)}
              >
                <span className="font-medium text-slate-800">{hit.fullName}</span>
                <span className="text-[11px] text-slate-500">
                  {[hit.employeeCode ? hit.employeeCode : null, hit.departmentName?.trim() || null].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
