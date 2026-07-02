"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string; children?: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} className={`${sectionAddRecordButtonClass} ${className}`} {...props}>
      {children ?? <PlusIcon />}
    </button>
  );
}

export function SectionRecordHeaderActions({
  count,
  onAdd,
  addTitle = "Add record",
  compactCountOnMobile = false,
  compact = false,
  disabled = false,
}: {
  count: number;
  onAdd: () => void;
  addTitle?: string;
  compactCountOnMobile?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const countClass = compact ? "text-xs text-slate-500" : "text-sm text-slate-500";
  const buttonClass = compact ? "h-7 w-7 shadow-violet-500/20" : "";
  const iconClass = compact ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className={`flex shrink-0 items-center ${compact ? "gap-2" : "gap-3"}`}>
      {compactCountOnMobile ? (
        <>
          <span className={`hidden sm:inline ${countClass}`}>{count} record(s)</span>
          <span className={`sm:hidden ${countClass}`}>{count}</span>
        </>
      ) : (
        <span className={countClass}>{count} record(s)</span>
      )}
      <SectionAddRecordButton onClick={onAdd} title={addTitle} disabled={disabled} className={buttonClass}>
        <PlusIcon className={iconClass} />
      </SectionAddRecordButton>
    </div>
  );
}
