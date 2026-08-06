"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface ScopeItem {
  id: string;
  name: string;
  level?: number;
}

interface ScopeCheckboxGroupProps {
  title: string;
  description: string;
  emptyMessage: string;
  organizationLink?: string;
  items: ScopeItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function ScopeCheckboxGroup({
  title,
  description,
  emptyMessage,
  organizationLink = "/app/org-structure",
  items,
  selectedIds,
  onChange,
}: ScopeCheckboxGroupProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/80 px-3 py-3 text-xs text-amber-900">
          {emptyMessage}{" "}
          <Link href={organizationLink} className="font-medium text-amber-950 underline underline-offset-2">
            Open Organization
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => onChange(allSelected ? [] : items.map((i) => i.id))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">No matches.</p>
            ) : (
              filtered.map((item) => {
                const checked = selectedIds.includes(item.id);
                const label =
                  item.level != null ? `${item.name} · L${item.level}` : item.name;
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      checked ? "bg-indigo-50 text-indigo-900" : "hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        onChange(
                          checked
                            ? selectedIds.filter((id) => id !== item.id)
                            : [...selectedIds, item.id]
                        );
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 accent-indigo-600"
                    />
                    <span className="font-medium text-slate-700">{label}</span>
                  </label>
                );
              })
            )}
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            {selectedIds.length === 0
              ? "No restriction — user can access all in this category."
              : `${selectedIds.length} selected`}
          </p>
        </>
      )}
    </div>
  );
}

interface UserAdvancedPermissionsPanelProps {
  locations: ScopeItem[];
  businessUnits: ScopeItem[];
  grades: ScopeItem[];
  jobTitles: ScopeItem[];
  selectedLocationIds: string[];
  selectedBusinessUnitIds: string[];
  selectedGradeIds: string[];
  selectedJobTitleIds: string[];
  onLocationChange: (ids: string[]) => void;
  onBusinessUnitChange: (ids: string[]) => void;
  onGradeChange: (ids: string[]) => void;
  onJobTitleChange: (ids: string[]) => void;
}

export function UserAdvancedPermissionsPanel({
  locations,
  businessUnits,
  grades,
  jobTitles,
  selectedLocationIds,
  selectedBusinessUnitIds,
  selectedGradeIds,
  selectedJobTitleIds,
  onLocationChange,
  onBusinessUnitChange,
  onGradeChange,
  onJobTitleChange,
}: UserAdvancedPermissionsPanelProps) {
  const restrictionCount =
    selectedLocationIds.length +
    selectedBusinessUnitIds.length +
    selectedGradeIds.length +
    selectedJobTitleIds.length;

  const [expanded, setExpanded] = useState(restrictionCount > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/60"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Advanced permissions</span>
            {restrictionCount > 0 ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                {restrictionCount} restriction{restrictionCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Full People access
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Optional. Limit which employee records this user can view in People. Leave empty for full access.
          </p>
        </div>
        <svg
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <ScopeCheckboxGroup
              title="Work locations"
              description="Restrict to employees at selected sites."
              emptyMessage="No work locations yet. Add them under Organization first."
              items={locations}
              selectedIds={selectedLocationIds}
              onChange={onLocationChange}
            />
            <ScopeCheckboxGroup
              title="Business units"
              description="Restrict to employees in selected units."
              emptyMessage="No business units loaded. Add them under Organization or check your license."
              items={businessUnits}
              selectedIds={selectedBusinessUnitIds}
              onChange={onBusinessUnitChange}
            />
            <ScopeCheckboxGroup
              title="Grades & bands"
              description="Restrict to employees in selected grades."
              emptyMessage="No grades loaded. Add them under Organization or check your license."
              items={grades}
              selectedIds={selectedGradeIds}
              onChange={onGradeChange}
            />
            <ScopeCheckboxGroup
              title="Job catalog"
              description="Restrict to employees with selected job titles."
              emptyMessage="No job titles loaded. Add them under Organization or check your license."
              items={jobTitles}
              selectedIds={selectedJobTitleIds}
              onChange={onJobTitleChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
