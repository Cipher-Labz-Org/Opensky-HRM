"use client";

import { useEffect, useState, type FormEvent } from "react";

function clampPage(value: number, totalPages: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(1, Math.round(value)), totalPages);
}

export function TablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  className = "",
  alwaysShow = false,
  showPagePicker = true,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Show row count and page controls even when everything fits on one page. */
  alwaysShow?: boolean;
  /** Allow typing or selecting a specific page number. */
  showPagePicker?: boolean;
}) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  if (totalCount === 0) return null;
  if (!alwaysShow && totalCount <= pageSize) return null;

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  function commitPageInput() {
    const parsed = parseInt(pageInput, 10);
    const next = clampPage(parsed, totalPages);
    setPageInput(String(next));
    if (next !== page) onPageChange(next);
  }

  function handlePageSubmit(e: FormEvent) {
    e.preventDefault();
    commitPageInput();
  }

  const navButtonClass =
    "rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-30";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 ${className}`.trim()}>
      <span className="text-xs text-slate-500">
        Showing {from}–{to} of {totalCount}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={navButtonClass}
        >
          Previous
        </button>

        {showPagePicker ? (
          <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor="table-pagination-page">
              Page number
            </label>
            <span className="text-xs text-slate-400">Page</span>
            <input
              id="table-pagination-page"
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs tabular-nums text-slate-700 outline-none transition [appearance:textfield] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-xs tabular-nums text-slate-400">of {totalPages}</span>
            <button type="submit" className={navButtonClass}>
              Go
            </button>
          </form>
        ) : (
          <span className="text-xs tabular-nums text-slate-400">
            Page {page} of {totalPages}
          </span>
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={navButtonClass}
        >
          Next
        </button>
      </div>
    </div>
  );
}
