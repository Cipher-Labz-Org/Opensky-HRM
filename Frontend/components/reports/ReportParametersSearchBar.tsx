"use client";

import { useEffect, useRef, useState } from "react";
import {
  reportGroupByLabel,
  type ReportFilterPill,
  type ReportFilterSection,
  type ReportGroupByKey,
  type ReportParamFilterKey,
} from "@/lib/report-parameters-search";

interface GroupByOption {
  key: ReportGroupByKey;
  label: string;
}

interface ReportParametersSearchBarProps {
  employeeSearch: string;
  onEmployeeSearchChange: (value: string) => void;
  onApply: () => void;
  groupBy: ReportGroupByKey | null;
  onGroupByChange: (key: ReportGroupByKey | null) => void;
  groupByOptions: GroupByOption[];
  filterSections: ReportFilterSection[];
  filterPills: ReportFilterPill[];
  onFilterChange: (key: ReportParamFilterKey, value: string) => void;
  onRemoveFilter: (key: ReportParamFilterKey) => void;
  activeFilterValues: Partial<Record<ReportParamFilterKey, string>>;
  onClearAll: () => void;
  loading?: boolean;
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3m-5.571-3v4.5"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-[#2B7DE9]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function FilterPill({
  label,
  onRemove,
  removeLabel,
  variant = "filter",
}: {
  label: string;
  onRemove: () => void;
  removeLabel: string;
  variant?: "group" | "filter";
}) {
  const styles =
    variant === "group"
      ? "bg-blue-50 text-blue-700 ring-blue-200/70"
      : "bg-slate-100 text-slate-600 ring-slate-200/80";

  return (
    <span className={`inline-flex max-w-[160px] items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${styles}`}>
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-current/45 transition hover:bg-black/5 hover:text-current"
        aria-label={removeLabel}
      >
        ×
      </button>
    </span>
  );
}

function MenuOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition ${
        active
          ? "bg-blue-50 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {active ? <CheckIcon /> : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function ReportParametersSearchBar({
  employeeSearch,
  onEmployeeSearchChange,
  onApply,
  groupBy,
  onGroupByChange,
  groupByOptions,
  filterSections,
  filterPills,
  onFilterChange,
  onRemoveFilter,
  activeFilterValues,
  onClearAll,
  loading = false,
}: ReportParametersSearchBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedFilterKey, setExpandedFilterKey] = useState<ReportParamFilterKey | null>(null);

  const hasActiveState = groupBy !== null || filterPills.length > 0 || Boolean(employeeSearch.trim());
  const activeFilterCount = filterPills.length + (groupBy ? 1 : 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (menuOpen && filterPills.length > 0) {
      setExpandedFilterKey(filterPills[0].key);
    }
  }, [menuOpen, filterPills]);

  function toggleMenu() {
    setMenuOpen((o) => !o);
  }

  function toggleGroupBy(key: ReportGroupByKey) {
    onGroupByChange(groupBy === key ? null : key);
    setMenuOpen(false);
  }

  return (
    <div className="relative w-full max-w-2xl" ref={rootRef}>
      {/* Search bar */}
      <div
        className={`flex h-11 items-center gap-1 rounded-2xl border bg-white px-2 shadow-sm transition-all ${
          menuOpen
            ? "border-blue-400/70 ring-2 ring-blue-100"
            : "border-slate-200 hover:border-slate-300 focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-100"
        } ${loading ? "opacity-75" : ""}`}
      >
        <button
          type="button"
          onClick={toggleMenu}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
            menuOpen || groupBy || filterPills.length > 0
              ? "bg-[#2B7DE9] text-white shadow-sm"
              : "text-[#2B7DE9] hover:bg-blue-50"
          }`}
          title="Group by & filters"
          aria-label="Group by and filters"
          aria-expanded={menuOpen}
        >
          <LayersIcon className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupBy && (
            <FilterPill
              variant="group"
              label={reportGroupByLabel(groupBy)}
              onRemove={() => onGroupByChange(null)}
              removeLabel={`Remove group by ${reportGroupByLabel(groupBy)}`}
            />
          )}
          {filterPills.map((pill) => (
            <FilterPill
              key={pill.key}
              label={pill.label}
              onRemove={() => onRemoveFilter(pill.key)}
              removeLabel={`Remove filter ${pill.label}`}
            />
          ))}
          <input
            type="text"
            placeholder="Search employees…"
            className="min-w-[140px] flex-1 border-0 bg-transparent py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            value={employeeSearch}
            onChange={(e) => onEmployeeSearchChange(e.target.value)}
            onFocus={() => setMenuOpen(true)}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onApply();
                setMenuOpen(false);
              }
              if (e.key === "Escape") setMenuOpen(false);
            }}
            disabled={loading}
          />
        </div>

        {loading ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-label="Loading">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-[#2B7DE9]" />
          </span>
        ) : (
          <>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAll();
                }}
                className="hidden shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:inline"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onApply();
                setMenuOpen(false);
              }}
              className="shrink-0 rounded-xl bg-[#2B7DE9] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#2568c7]"
            >
              Search
            </button>
          </>
        )}
      </div>

      {/* Dropdown: Group By | Filters */}
      {menuOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 flex w-[min(520px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60">
          {/* Group By */}
          {groupByOptions.length > 0 && (
            <div className="flex w-[44%] shrink-0 flex-col border-r border-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                <LayersIcon className="h-3.5 w-3.5 text-[#2B7DE9]" />
                <span className="text-[12px] font-semibold text-slate-800">Group By</span>
              </div>
              <ul className="max-h-[260px] space-y-0.5 overflow-y-auto p-1.5">
                {groupByOptions.map((opt) => (
                  <li key={opt.key}>
                    <MenuOption
                      active={groupBy === opt.key}
                      label={opt.label}
                      onClick={() => toggleGroupBy(opt.key)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Filters */}
          <div className="flex min-w-0 flex-1 flex-col bg-slate-50/40">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2.5">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="text-[12px] font-semibold text-slate-800">Filters</span>
            </div>

            <div className="max-h-[260px] overflow-y-auto p-1.5">
              {filterSections.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-slate-400">No filters available</p>
              ) : (
                filterSections.map((section) => {
                  const sectionOpen = expandedFilterKey === section.key;
                  const activeValue = activeFilterValues[section.key];
                  const activeLabel = section.options.find((o) => o.value === activeValue)?.label;
                  return (
                    <div key={section.key} className="mb-0.5">
                      <button
                        type="button"
                        onClick={() => setExpandedFilterKey(sectionOpen ? null : section.key)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-slate-700">{section.label}</div>
                          {activeLabel && (
                            <div className="truncate text-[10px] text-[#2B7DE9]">{activeLabel}</div>
                          )}
                        </div>
                        <svg
                          className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-200 ${sectionOpen ? "rotate-180" : ""}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 14l-5-5h10l-5 5z" />
                        </svg>
                      </button>
                      {sectionOpen && (
                        <ul className="mb-1 max-h-[140px] space-y-0.5 overflow-y-auto rounded-lg bg-white p-1 ring-1 ring-slate-100">
                          {section.options.length === 0 ? (
                            <li className="px-2.5 py-2 text-[12px] text-slate-400">No options</li>
                          ) : (
                            section.options.map((opt) => (
                              <li key={opt.value}>
                                <MenuOption
                                  active={activeValue === opt.value}
                                  label={opt.label}
                                  onClick={() => onFilterChange(section.key, opt.value)}
                                />
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {hasActiveState && (
              <div className="mt-auto border-t border-slate-100 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setMenuOpen(false);
                  }}
                  className="text-[12px] font-medium text-slate-500 transition hover:text-rose-600"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
