"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  fullName?: string;
  firstName?: string;
  lastName?: string;
  employeeCode: string;
  departmentName?: string | null;
}

function hitName(hit: Hit): string {
  const fromParts = `${hit.firstName ?? ""} ${hit.lastName ?? ""}`.trim();
  return (hit.fullName ?? "").trim() || fromParts || hit.employeeCode || "Unknown";
}

function formatLabel(e: Pick<EmployeeSearchPick, "firstName" | "lastName" | "employeeCode"> & { fullName?: string }) {
  const name = (e.fullName ?? "").trim() || `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || "Employee";
  const code = e.employeeCode?.trim();
  return `${name}${code ? ` (${code})` : ""}`;
}

function hitToPick(hit: Hit): EmployeeSearchPick {
  const parts = hitName(hit).split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;
  return {
    id: hit.id,
    firstName,
    lastName,
    profileImageUrl: null,
    employeeCode: hit.employeeCode,
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-10 text-sm text-slate-700 outline-none transition " +
  "focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Type-ahead employee lookup (GET /api/employees/lookup), same interaction pattern as
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
  allowClear = false,
  clearLabel = "All employees",
  ariaLabel = "Employee",
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
  /** Show an "All employees" row that clears the selection. */
  allowClear?: boolean;
  clearLabel?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPickedId = useRef("");
  const inputId = useId();
  const listId = useId();

  const [inputText, setInputText] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateMenuPos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 240) });
  }, []);

  useEffect(() => {
    if (!value) {
      if (lastPickedId.current) {
        lastPickedId.current = "";
        setInputText("");
      }
      return;
    }
    if (lastPickedId.current === value) return;
    let cancelled = false;
    apiFetch<EmployeeSearchPick & { fullName?: string }>(`/api/employees/${value}`)
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
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    function onWin() {
      updateMenuPos();
    }
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updateMenuPos]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    setLoading(true);
    setOpen(true);
    updateMenuPos();
    try {
      const params = new URLSearchParams({ pageSize: "100", excludeTerminated: "true" });
      if (q.length > 0) params.set("search", q);
      if (departmentId) params.set("departmentId", departmentId);
      let res: { items: Hit[] };
      try {
        res = await apiFetch<{ items: Hit[] }>(`/api/employees/lookup?${params}`);
      } catch {
        res = await apiFetch<{ items: Hit[] }>(`/api/employees?${params}`);
      }
      const excluded = new Set((excludeEmployeeIds ?? []).map((employeeId) => employeeId.trim().toLowerCase()));
      const items = (res.items ?? []).filter((hit) => {
        const id = String(hit.id ?? "").trim().toLowerCase();
        return id.length > 0 && !excluded.has(id);
      });
      setHits(items);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, [departmentId, excludeEmployeeIds, updateMenuPos]);

  function onInputChange(next: string) {
    const sanitized = sanitizeSearchInput(next);
    lastPickedId.current = "";
    setInputText(sanitized);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value) onPick(null);
    debounceRef.current = setTimeout(() => void runSearch(sanitized), 280);
  }

  function toggleOpen() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    void runSearch(inputText);
  }

  function chooseHit(hit: Hit) {
    const pick = hitToPick(hit);
    lastPickedId.current = pick.id;
    setOpen(false);
    setInputText(hit.employeeCode?.trim() ? `${hitName(hit)} (${hit.employeeCode.trim()})` : hitName(hit));
    onPick(pick);
  }

  function chooseAll() {
    lastPickedId.current = "";
    setOpen(false);
    setInputText("");
    onPick(null);
  }

  const list = open && menuPos && typeof document !== "undefined" ? createPortal(
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
      className="fixed z-[10050] max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
    >
      {allowClear && (
        <li role="presentation">
          <button
            type="button"
            role="option"
            className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-600 hover:bg-[#e3eef8]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={chooseAll}
          >
            {clearLabel}
          </button>
        </li>
      )}
      {loading && hits.length === 0 && (
        <li className="px-3 py-2 text-sm text-slate-400">Loading employees…</li>
      )}
      {!loading && hits.length === 0 && (
        <li className="px-3 py-2 text-sm text-slate-400">No employees found</li>
      )}
      {hits.map((hit) => (
        <li key={hit.id} role="presentation">
          <button
            type="button"
            role="option"
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-[#e3eef8]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => chooseHit(hit)}
          >
            <span className="font-medium text-slate-800">{hitName(hit)}</span>
            <span className="text-[11px] text-slate-500">
              {[hit.employeeCode ? hit.employeeCode : null, hit.departmentName?.trim() || null].filter(Boolean).join(" · ")}
            </span>
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <label htmlFor={inputId} className="sr-only">
        {ariaLabel}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          disabled={disabled}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (!disabled) void runSearch(inputText);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) void runSearch(inputText);
            }
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          className={inputClass}
          placeholder={placeholder}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? "Close employee list" : "Open employee list"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleOpen}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180" : ""}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {loading && (
          <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
            …
          </span>
        )}
      </div>
      {list}
    </div>
  );
}
