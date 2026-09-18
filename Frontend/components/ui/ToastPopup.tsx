"use client";

import { useCallback } from "react";
import { SUCCESS_ALERT_DISMISS_MS, useAutoDismiss } from "@/lib/use-auto-dismiss";

type ToastPopupProps = {
  /** When set, the success popup is shown. */
  open: boolean;
  onDismiss: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  /** Set false to keep the popup open until the user closes it. */
  autoDismiss?: boolean;
};

/** Centered success popup — auto-dismisses after 5 seconds unless `autoDismiss` is false. */
export function ToastPopup({
  open,
  onDismiss,
  title = "Success!",
  message = "Your changes have been saved.",
  confirmLabel = "Okay",
  autoDismiss = true,
}: ToastPopupProps) {
  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  useAutoDismiss(open && autoDismiss, dismiss, SUCCESS_ALERT_DISMISS_MS);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[13000] flex items-start justify-center bg-slate-900/30 px-4 pt-16 backdrop-blur-[2px] sm:items-center sm:pt-0"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="toast-popup-title"
      aria-describedby="toast-popup-message"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="toast-popup relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-center shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-100/50 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-sky-100/40 blur-2xl" />

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative px-7 pb-6 pt-9">
          <div className="toast-popup-check mx-auto mb-5 grid h-[76px] w-[76px] place-items-center rounded-full border border-blue-200/70 bg-gradient-to-br from-blue-50 to-sky-100 text-blue-600 shadow-sm shadow-blue-900/5">
            <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <div className="mb-3 inline-flex rounded-full border border-blue-200/60 bg-blue-50/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            OpenSky HRM
          </div>

          <h2 id="toast-popup-title" className="text-xl font-semibold tracking-tight text-slate-800">
            {title}
          </h2>
          <p id="toast-popup-message" className="mt-2 text-sm leading-relaxed text-slate-500">
            {message}
          </p>

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 w-full rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          >
            {confirmLabel}
          </button>

          {autoDismiss ? (
            <p className="mt-3 text-[11px] text-slate-400">Closes automatically in 5 seconds</p>
          ) : null}
        </div>

        {autoDismiss ? (
          <div className="h-1 w-full bg-slate-100" aria-hidden>
            <div
              key={open ? "running" : "idle"}
              className="toast-popup-progress h-full origin-left rounded-r-full bg-gradient-to-r from-blue-500 to-sky-400"
              style={{ animationDuration: `${SUCCESS_ALERT_DISMISS_MS}ms` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
