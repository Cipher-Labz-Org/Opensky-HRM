"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";

/** Filter org lookup lists to the user's assigned dimension IDs when restrictions exist. */
export function filterLookupsByAllowedIds<T extends { id: string }>(
  items: T[],
  allowedIds: string[] | undefined,
): T[] {
  if (!allowedIds?.length) return items;
  const allowed = new Set(allowedIds);
  return items.filter((item) => allowed.has(item.id));
}

/** Scoped org catalog filters derived from the logged-in user's People dimension assignments. */
export function usePeopleScopedLookups() {
  const { user, hasPeopleDimensionRestrictions } = useAuth();

  const filterLocations = useMemo(
    () => <T extends { id: string }>(items: T[]) => filterLookupsByAllowedIds(items, user?.assignedLocationIds),
    [user?.assignedLocationIds],
  );

  const filterBusinessUnits = useMemo(
    () => <T extends { id: string }>(items: T[]) => filterLookupsByAllowedIds(items, user?.assignedBusinessUnitIds),
    [user?.assignedBusinessUnitIds],
  );

  const filterGrades = useMemo(
    () => <T extends { id: string }>(items: T[]) => filterLookupsByAllowedIds(items, user?.assignedGradeIds),
    [user?.assignedGradeIds],
  );

  const filterJobTitles = useMemo(
    () => <T extends { id: string }>(items: T[]) => filterLookupsByAllowedIds(items, user?.assignedJobTitleIds),
    [user?.assignedJobTitleIds],
  );

  return {
    hasRestrictions: hasPeopleDimensionRestrictions(),
    filterLocations,
    filterBusinessUnits,
    filterGrades,
    filterJobTitles,
    assignedLocationIds: user?.assignedLocationIds,
    assignedBusinessUnitIds: user?.assignedBusinessUnitIds,
    assignedGradeIds: user?.assignedGradeIds,
    assignedJobTitleIds: user?.assignedJobTitleIds,
  };
}
