type AppTopbarProps = {
  title: string;
  subtitle?: string;
};

/**
 * Page title strip — same size and style on every module page.
 */
export function AppTopbar({ title, subtitle }: AppTopbarProps) {
  return (
    <div className="relative -mx-7 mb-6 overflow-hidden border-b border-slate-200 bg-white px-7 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-[#2E7BBF] shadow-[0_0_12px_rgba(46,123,191,0.28)]"
        aria-hidden
      />
      <div className="relative pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem] md:text-[2rem] md:leading-snug">
            {title}
          </h1>
          <span className="hidden rounded-full border border-[#2E7BBF]/20 bg-[#2E7BBF]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1a5f94] sm:inline-flex">
            OpenSky HRM
          </span>
        </div>
        <div className="mt-2 h-0.5 max-w-xs rounded-full bg-[#2E7BBF]/70" aria-hidden />
        {null}
      </div>
    </div>
  );
}
