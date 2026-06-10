"use client";

import type { ButtonHTMLAttributes } from "react";

export const sectionAddRecordButtonClass =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-sm shadow-violet-500/25 transition hover:bg-violet-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50";

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

export function SectionAddRecordButton({
  title = "Add record",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button type="button" title={title} aria-label={title} className={`${sectionAddRecordButtonClass} ${className}`} {...props}>
      <PlusIcon />
    </button>
  );
}

export function SectionRecordHeaderActions({
  count,
  onAdd,
  addTitle = "Add record",
  compactCountOnMobile = false,
  disabled = false,
}: {
  count: number;
  onAdd: () => void;
  addTitle?: string;
  compactCountOnMobile?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {compactCountOnMobile ? (
        <>
          <span className="hidden text-sm text-slate-500 sm:inline">{count} record(s)</span>
          <span className="text-sm text-slate-500 sm:hidden">{count}</span>
        </>
      ) : (
        <span className="text-sm text-slate-500">{count} record(s)</span>
      )}
      <SectionAddRecordButton onClick={onAdd} title={addTitle} disabled={disabled} />
    </div>
  );
}
