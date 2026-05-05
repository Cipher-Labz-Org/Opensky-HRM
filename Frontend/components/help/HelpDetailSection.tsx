"use client";

import type { ReactNode } from "react";

export function HelpDetailSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 text-sm leading-6 text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
