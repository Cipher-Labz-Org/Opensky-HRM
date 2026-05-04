import type { ReactNode } from "react";

/** Full-width white help card on the gray canvas (matches People Hub guide layout). */
export function HelpDetailSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-7"
    >
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-[1.65] text-slate-600">{children}</div>
    </section>
  );
}
