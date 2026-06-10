"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export function useClientPagination<T>(items: readonly T[], pageSize = DEFAULT_TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageItems,
    totalCount,
    totalPages,
    pageSize,
    showPagination: totalCount > pageSize,
  };
}
