"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveAssetUrl } from "@/config/constants";
import {
  PEOPLE_GROUP_BY_OPTIONS,
  PEOPLE_STATUS_FILTER_OPTIONS,
  peopleGroupByLabel,
  peopleStatusFilterLabel,
  type PeopleGroupByKey,
  type PeopleHubFieldFilterKey,
  type PeopleHubFilterPill,
  type PeopleHubFilterSection,
  type PeopleHubStatusFilter,
} from "@/lib/people-hub-search";
import {
  filterPeopleHubEmployeeFavorites,
  type PeopleHubDiscoverEmployee,
  type PeopleHubEmployeeFavorite,
} from "@/lib/people-hub-employee-favorites";
import { PeopleHubEmployeeFavoriteButton } from "@/components/people/PeopleHubEmployeeFavoriteButton";

interface PeopleHubSearchBarProps {
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  onQuickSearchSubmit: () => void;
  groupBy: PeopleGroupByKey | null;
  onGroupByChange: (key: PeopleGroupByKey | null) => void;
  statusFilter: PeopleHubStatusFilter;
  onStatusFilterChange: (value: PeopleHubStatusFilter) => void;
  filterSections: PeopleHubFilterSection[];
  filterPills: PeopleHubFilterPill[];
  onFilterChange: (key: PeopleHubFieldFilterKey, value: string) => void;
  onRemoveFilter: (key: PeopleHubFilterPill["key"]) => void;
  activeFilterValues: Partial<Record<PeopleHubFieldFilterKey, string>>;
  onClearAll: () => void;
  employeeFavorites: PeopleHubEmployeeFavorite[];
  onOpenEmployeeFavorite: (favorite: PeopleHubEmployeeFavorite) => void;
  onDeleteEmployeeFavorite: (id: string) => void;
  onFavoritesDiscoverQueryChange: (query: string) => void;
  favoritesDiscoverResults: PeopleHubDiscoverEmployee[];
  favoritesDiscoverLoading: boolean;
  isEmployeeFavorite: (employeeId: string) => boolean;
  onToggleEmployeeFavorite: (employee: PeopleHubDiscoverEmployee) => void;
  showSuggestions: boolean;
  onFocusSearch: () => void;
  onDismissSuggestions: () => void;
  suggestionsSlot?: React.ReactNode;
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
}: {
  label: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <span className="inline-flex max-w-[140px] items-center gap-1 rounded-md bg-slate-100/90 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-700"
        aria-label={removeLabel}
      >
        ×
      </button>
    </span>
  );
}

function MenuSectionHeader({
  icon,
  title,
  iconClassName,
}: {
  icon: React.ReactNode;
  title: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${iconClassName ?? ""}`}>{icon}</span>
      <span className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</span>
    </div>
  );
}

function MenuOption({
  active,
  label,
  onClick,
  indented = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  indented?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-left text-[13px] transition ${
        indented ? "pl-7 pr-3" : "px-3"
      } ${
        active
          ? "bg-blue-50 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{active ? <CheckIcon /> : null}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function PeopleHubSearchBar({
  quickSearch,
  onQuickSearchChange,
  onQuickSearchSubmit,
  groupBy,
  onGroupByChange,
  statusFilter,
  onStatusFilterChange,
  filterSections,
  filterPills,
  onFilterChange,
  onRemoveFilter,
  activeFilterValues,
  onClearAll,
  employeeFavorites,
  onOpenEmployeeFavorite,
  onDeleteEmployeeFavorite,
  onFavoritesDiscoverQueryChange,
  favoritesDiscoverResults,
  favoritesDiscoverLoading,
  isEmployeeFavorite,
  onToggleEmployeeFavorite,
  showSuggestions,
  onFocusSearch,
  onDismissSuggestions,
  suggestionsSlot,
}: PeopleHubSearchBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedFilterKey, setExpandedFilterKey] = useState<PeopleHubFieldFilterKey | null>(null);
  const [favoritesSearch, setFavoritesSearch] = useState("");

  const filteredEmployeeFavorites = useMemo(
    () => filterPeopleHubEmployeeFavorites(employeeFavorites, favoritesSearch, 50),
    [employeeFavorites, favoritesSearch],
  );

  const favoritesQuery = favoritesSearch.trim();
  const showDiscoverEmployees = favoritesQuery.length >= 1;

  useEffect(() => {
    onFavoritesDiscoverQueryChange(favoritesSearch);
  }, [favoritesSearch, onFavoritesDiscoverQueryChange]);

  const hasActiveState =
    groupBy !== null ||
    statusFilter !== "active" ||
    filterPills.length > 0 ||
    Boolean(quickSearch.trim());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        onDismissSuggestions();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismissSuggestions]);

  useEffect(() => {
    if (menuOpen) {
      setStatusOpen(true);
      setFiltersOpen(filterPills.length > 0);
    }
  }, [menuOpen, filterPills.length]);

  const isSearching = showSuggestions && Boolean(quickSearch.trim());
  const showFilterMenu = menuOpen && !isSearching;

  function toggleMenu() {
    setMenuOpen((o) => !o);
  }

  function openMenu() {
    setMenuOpen(true);
  }

  function toggleGroupBy(key: PeopleGroupByKey) {
    onGroupByChange(groupBy === key ? null : key);
    setMenuOpen(false);
  }

  return (
    <div className="relative w-full" ref={rootRef}>
      {/* Search input row */}
      <div
        className={`flex h-10 items-center gap-1.5 rounded-xl border bg-white pl-2.5 pr-1.5 shadow-sm transition-all ${
          showFilterMenu || isSearching
            ? "border-[#2B7DE9]/60 ring-2 ring-[#2B7DE9]/10"
            : "border-slate-200 hover:border-slate-300 focus-within:border-[#2B7DE9]/60 focus-within:ring-2 focus-within:ring-[#2B7DE9]/10"
        }`}
      >
        <button
          type="button"
          onClick={openMenu}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-600"
          aria-label="Open group by and filters"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={toggleMenu}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
            menuOpen || groupBy ? "bg-[#2B7DE9] text-white shadow-sm" : "text-[#2B7DE9] hover:bg-blue-50"
          }`}
          title="Group by & filters"
          aria-label="Group by and filters"
          aria-expanded={menuOpen}
        >
          <LayersIcon className="h-4 w-4" />
        </button>

        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
          onClick={openMenu}
        >
          {groupBy && (
            <FilterPill
              label={peopleGroupByLabel(groupBy)}
              onRemove={() => onGroupByChange(null)}
              removeLabel={`Remove group by ${peopleGroupByLabel(groupBy)}`}
            />
          )}
          {statusFilter !== "active" && (
            <FilterPill
              label={peopleStatusFilterLabel(statusFilter)}
              onRemove={() => onStatusFilterChange("active")}
              removeLabel="Reset status to Active"
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
            placeholder="Search…"
            className="min-w-[72px] flex-1 border-0 bg-transparent py-1.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            value={quickSearch}
            onChange={(e) => {
              onQuickSearchChange(e.target.value);
              if (e.target.value.trim()) setMenuOpen(false);
            }}
            onFocus={() => {
              if (!quickSearch.trim()) openMenu();
              onFocusSearch();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setMenuOpen(false);
                onQuickSearchSubmit();
              }
              if (e.key === "Escape") {
                setMenuOpen(false);
                onDismissSuggestions();
              }
            }}
          />
        </div>

        <button
          type="button"
          onClick={openMenu}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
            menuOpen ? "bg-blue-50 text-[#2B7DE9]" : "text-[#2B7DE9] hover:bg-blue-50"
          }`}
          aria-label={menuOpen ? "Group by menu open" : "Open group by menu"}
          aria-expanded={menuOpen}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 14l-5-5h10l-5 5z" />
          </svg>
        </button>
      </div>

      {isSearching && suggestionsSlot}

      {/* Dropdown panel */}
      {showFilterMenu && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 flex w-[min(620px,calc(100vw-2rem))] max-h-[min(420px,calc(100vh-10rem))] items-start overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50">
          {/* Group By + Status */}
          <div className="flex max-h-[inherit] w-[52%] shrink-0 flex-col overflow-y-auto border-r border-slate-100">
            <MenuSectionHeader
              icon={<LayersIcon className="h-4 w-4" />}
              title="Group By"
              iconClassName="text-[#2B7DE9]"
            />

            <ul className="px-1.5 pb-1">
              {PEOPLE_GROUP_BY_OPTIONS.map((opt) => (
                <li key={opt.key}>
                  <MenuOption
                    active={groupBy === opt.key}
                    label={opt.label}
                    onClick={() => toggleGroupBy(opt.key)}
                  />
                </li>
              ))}
            </ul>

            <div className="mx-3 border-t border-slate-100" />

            <div className="px-1.5 py-1">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 14l-5-5h10l-5 5z" />
                </svg>
              </button>

              {filtersOpen && (
                <div className="pb-1">
                  {filterSections.map((section) => {
                    const sectionOpen = expandedFilterKey === section.key;
                    const activeValue = activeFilterValues[section.key];
                    return (
                      <div key={section.key}>
                        <button
                          type="button"
                          onClick={() => setExpandedFilterKey(sectionOpen ? null : section.key)}
                          className="flex w-full items-center justify-between rounded-lg py-2 pl-7 pr-3 text-left text-[13px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                        >
                          <span className="truncate">{section.label}</span>
                          <svg
                            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-200 ${sectionOpen ? "rotate-180" : ""}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 14l-5-5h10l-5 5z" />
                          </svg>
                        </button>
                        {sectionOpen && (
                          <ul className="max-h-[120px] overflow-y-auto pb-1 pl-4">
                            {section.options.length === 0 ? (
                              <li className="px-3 py-2 text-[12px] text-slate-400">No options available</li>
                            ) : (
                              section.options.map((opt) => (
                                <li key={opt.value}>
                                  <MenuOption
                                    active={activeValue === opt.value}
                                    label={opt.label}
                                    indented
                                    onClick={() => onFilterChange(section.key, opt.value)}
                                  />
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mx-3 border-t border-slate-100" />

            <div className="px-1.5 py-1">
              <button
                type="button"
                onClick={() => setStatusOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-50"
              >
                <span className="text-[13px] font-semibold text-slate-800">Status</span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${statusOpen ? "rotate-180" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 14l-5-5h10l-5 5z" />
                </svg>
              </button>

              {statusOpen && (
                <ul className="pb-2">
                  {PEOPLE_STATUS_FILTER_OPTIONS.map((opt) => (
                    <li key={opt.value}>
                      <MenuOption
                        active={statusFilter === opt.value}
                        label={opt.label}
                        indented
                        onClick={() => onStatusFilterChange(opt.value)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {hasActiveState && (
              <div className="border-t border-slate-100 px-3 py-2">
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

          {/* Favorites */}
          <div className="flex max-h-[inherit] min-w-0 flex-1 flex-col overflow-y-auto bg-slate-50/40">
            <MenuSectionHeader
              icon={
                <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" />
                </svg>
              }
              title="Favorites"
            />

            <div className="px-2 pb-2" onMouseDown={(e) => e.stopPropagation()}>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={favoritesSearch}
                  onChange={(e) => setFavoritesSearch(e.target.value)}
                  placeholder="Search saved favorites or find employees…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#2B7DE9] focus:ring-2 focus:ring-[#2B7DE9]/15"
                />
              </div>
            </div>

            <div className="border-t border-slate-200/70 px-2 py-1.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Favorite employees
              </p>
              {filteredEmployeeFavorites.length > 0 ? (
                <ul className="max-h-[100px] overflow-y-auto">
                  {filteredEmployeeFavorites.map((fav) => (
                    <li key={fav.id} className="group flex items-start gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenEmployeeFavorite(fav);
                          setMenuOpen(false);
                        }}
                        className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition hover:bg-amber-50"
                      >
                        <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700 group-hover:text-amber-900">
                          <span className="text-amber-500">★</span>
                          <span className="truncate">{fav.fullName}</span>
                        </div>
                        <div className="mt-0.5 truncate pl-5 text-[10px] text-slate-400 group-hover:text-amber-800/80">
                          {fav.employeeCode}
                          {fav.departmentName ? ` · ${fav.departmentName}` : ""}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEmployeeFavorite(fav.id);
                        }}
                        className="shrink-0 rounded-md px-2 py-1.5 text-[11px] text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        aria-label={`Remove ${fav.fullName} from favorites`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-2 text-[11px] leading-relaxed text-slate-400">
                  {favoritesQuery
                    ? "No favorite employees match your search."
                    : "Search above to find employees, or star them from results."}
                </p>
              )}
            </div>

            {showDiscoverEmployees && (
              <div className="border-t border-slate-200/70 px-2 py-1.5">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {favoritesDiscoverLoading ? "Searching employees…" : "Add employees"}
                </p>
                {!favoritesDiscoverLoading && favoritesDiscoverResults.length === 0 && (
                  <p className="px-2 py-2 text-[11px] leading-relaxed text-slate-400">
                    No employees found for &ldquo;{favoritesQuery}&rdquo;.
                  </p>
                )}
                {favoritesDiscoverResults.length > 0 && (
                  <ul className="max-h-[120px] overflow-y-auto">
                    {favoritesDiscoverResults.map((emp) => {
                      const idx = emp.fullName.toLowerCase().indexOf(favoritesQuery.toLowerCase());
                      const initials = emp.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                      const favorited = isEmployeeFavorite(emp.id);
                      return (
                        <li key={emp.id} className="flex items-center gap-1 px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenEmployeeFavorite({
                                id: emp.id,
                                employeeId: emp.id,
                                employeeCode: emp.employeeCode,
                                fullName: emp.fullName,
                                departmentName: emp.departmentName,
                                jobTitleName: emp.jobTitleName,
                                profileImageUrl: emp.profileImageUrl,
                                savedAt: "",
                              });
                              setMenuOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-blue-50/70"
                          >
                            {emp.profileImageUrl ? (
                              <img
                                src={resolveAssetUrl(emp.profileImageUrl) ?? ""}
                                alt={emp.fullName}
                                className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-50 ring-1 ring-slate-200 text-[9px] font-semibold text-slate-500">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-medium text-slate-800">
                                {idx >= 0 ? (
                                  <>
                                    {emp.fullName.slice(0, idx)}
                                    <span className="bg-yellow-100 text-yellow-800">{emp.fullName.slice(idx, idx + favoritesQuery.length)}</span>
                                    {emp.fullName.slice(idx + favoritesQuery.length)}
                                  </>
                                ) : (
                                  emp.fullName
                                )}
                              </div>
                              <div className="truncate text-[10px] text-slate-400">
                                {emp.employeeCode}
                                {emp.departmentName ? ` · ${emp.departmentName}` : ""}
                              </div>
                            </div>
                          </button>
                          <PeopleHubEmployeeFavoriteButton
                            active={favorited}
                            size="sm"
                            onToggle={() => onToggleEmployeeFavorite(emp)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
