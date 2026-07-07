/** Shared modal shell sizing — used by Modal, app dialogs, and inline modal panels. */

export const modalOverlayClass =
  "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 pt-12 pb-10 backdrop-blur-[2px]";

export const modalShellBaseClass =
  "relative w-full overflow-visible rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]";

export const modalShellWidthClass = (wide?: boolean) => (wide ? "max-w-4xl" : "max-w-2xl");

export const modalHeaderClass = "relative border-b border-slate-100 px-8 py-5";

export const modalBodyClass = "relative px-8 py-6";
