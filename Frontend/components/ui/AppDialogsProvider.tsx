"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  appAlert,
  type AppDialogOptions,
  registerAppDialogHandlers,
  unregisterAppDialogHandlers,
} from "@/components/ui/appDialogs";

type DialogKind = "confirm" | "alert" | "prompt";

type DialogRequest = {
  kind: DialogKind;
  title: string;
  message: string;
  options: AppDialogOptions;
  resolve: (value: boolean | void | string | null) => void;
};

function inferVariant(title: string, message: string, variant?: AppDialogOptions["variant"]) {
  if (variant) return variant;
  const text = `${title} ${message}`.toLowerCase();
  if (/\b(delete|remove|reject|terminate|discard|permanently)\b/.test(text)) return "danger";
  return "default";
}

function defaultConfirmLabel(variant: "default" | "danger") {
  return variant === "danger" ? "Delete" : "Continue";
}

export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [promptValue, setPromptValue] = useState("");

  const push = useCallback((req: DialogRequest) => {
    if (req.kind === "prompt") {
      setPromptValue(req.options.defaultValue ?? "");
    }
    setQueue((prev) => [...prev, req]);
  }, []);

  const closeTop = useCallback((value: boolean | void | string | null) => {
    setQueue((prev) => {
      const [top, ...rest] = prev;
      top?.resolve(value);
      return rest;
    });
  }, []);

  const handlers = useMemo(
    () => ({
      confirm: (message: string, options: AppDialogOptions = {}) =>
        new Promise<boolean>((resolve) =>
          push({
            kind: "confirm",
            title: options.title ?? "Please Confirm",
            message,
            options,
            resolve: (v) => resolve(Boolean(v)),
          })
        ),
      alert: (message: string, options: AppDialogOptions = {}) =>
        new Promise<void>((resolve) =>
          push({
            kind: "alert",
            title: options.title ?? "Notice",
            message,
            options,
            resolve: () => resolve(),
          })
        ),
      prompt: (message: string, options: AppDialogOptions = {}) =>
        new Promise<string | null>((resolve) =>
          push({
            kind: "prompt",
            title: options.title ?? "Input Required",
            message,
            options,
            resolve: (v) => resolve(typeof v === "string" ? v : null),
          })
        ),
    }),
    [push]
  );

  useEffect(() => {
    registerAppDialogHandlers(handlers);
    return () => unregisterAppDialogHandlers();
  }, [handlers]);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      void appAlert(String(message ?? ""));
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const top = queue[0];
  const variant = top ? inferVariant(top.title, top.message, top.options.variant) : "default";
  const confirmLabel = top?.options.confirmLabel ?? (top?.kind === "alert" ? "OK" : defaultConfirmLabel(variant));
  const cancelLabel = top?.options.cancelLabel ?? "Cancel";

  return (
    <>
      {children}
      {top ? (
        <div
          className="fixed inset-0 z-[12000] flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 pt-16 pb-10 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && top.kind !== "prompt") closeTop(top.kind === "confirm" ? false : undefined);
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/40 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-sky-100/35 blur-2xl" />
            <div className="relative border-b border-slate-100 px-6 py-4">
              <div className="mb-1 inline-flex rounded-full border border-blue-200/60 bg-blue-50/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                OpenSky HRM
              </div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-800">{top.title}</h2>
                <button
                  type="button"
                  onClick={() => closeTop(top.kind === "confirm" ? false : top.kind === "prompt" ? null : undefined)}
                  className="grid h-8 w-8 place-items-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="relative px-6 py-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{top.message}</p>
              {top.kind === "prompt" ? (
                <input
                  autoFocus
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder={top.options.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") closeTop(promptValue);
                    if (e.key === "Escape") closeTop(null);
                  }}
                  className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              ) : null}
              <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                {top.kind === "confirm" || top.kind === "prompt" ? (
                  <button
                    type="button"
                    onClick={() => closeTop(top.kind === "prompt" ? null : false)}
                    className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {cancelLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (top.kind === "prompt") closeTop(promptValue);
                    else closeTop(true);
                  }}
                  className={
                    variant === "danger"
                      ? "rounded-full bg-red-600 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                      : "rounded-full bg-blue-600 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  }
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
