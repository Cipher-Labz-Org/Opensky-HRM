type AppTopbarProps = {
  title: string;
  subtitle?: string;
};

/**
 * Page topbar for app pages: title, subtitle, optional actions.
 * Aligned with hris_ui_pack topbar.
 */
export function AppTopbar({ title, subtitle }: AppTopbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)] md:text-[28px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-[var(--muted)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="min-w-[280px] rounded-[14px] border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3 text-sm text-[var(--muted)] shadow-[var(--shadow)]">
          Search…
        </span>
        <button
          type="button"
          className="rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]"
        >
          Export
        </button>
        <button
          type="button"
          className="rounded-[14px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow)]"
        >
          Create New
        </button>
      </div>
    </div>
  );
}
