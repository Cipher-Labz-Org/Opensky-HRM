"use client";

import { type ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 pt-16 pb-10 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-sky-100/35 blur-2xl" />
        <div className="relative border-b border-slate-100 px-6 py-4">
          <div className="mb-1 inline-flex rounded-full border border-blue-200/60 bg-blue-50/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            OpenSky HRM
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="relative px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
