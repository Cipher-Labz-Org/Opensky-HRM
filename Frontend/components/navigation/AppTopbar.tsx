type AppTopbarProps = {
  title: string;
  subtitle?: string;
};

/**
 * Page title strip — OpenSky navy + green accent.
 */
export function AppTopbar({ title, subtitle }: AppTopbarProps) {
  return (
    <div className="app-page-topbar relative -mx-7 mb-6 overflow-hidden border-b px-7 py-5">
      <div
        className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-[#76B82A] shadow-[0_0_12px_rgba(118,184,42,0.28)]"
        aria-hidden
      />
      <div className="relative pl-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#76B82A]" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#5B7087]">OpenSky HRM</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#081F3E] sm:text-[1.75rem] md:text-[2rem] md:leading-snug">
            {title}
          </h1>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-[#5B7087]">{subtitle}</p> : null}
        <div className="mt-2 h-0.5 max-w-xs rounded-full bg-[#76B82A]/70" aria-hidden />
      </div>
    </div>
  );
}
