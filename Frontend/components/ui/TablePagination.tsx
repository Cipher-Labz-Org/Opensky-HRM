"use client";

export function TablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  className = "",
  alwaysShow = false,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Show row count and page controls even when everything fits on one page. */
  alwaysShow?: boolean;
}) {
  if (totalCount === 0) return null;
  if (!alwaysShow && totalCount <= pageSize) return null;

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 ${className}`.trim()}>
      <span className="text-xs text-slate-500">
        Showing {from}–{to} of {totalCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
        >
          Previous
        </button>
        <span className="text-xs tabular-nums text-slate-400">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}
