"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { appAlert, registerAppDialogHandlers, unregisterAppDialogHandlers } from "@/components/ui/appDialogs";

type DialogRequest = {
  kind: "confirm" | "alert";
  title: string;
  message: string;
  resolve: (value: boolean | void) => void;
};

export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  const push = useCallback((req: DialogRequest) => {
    setQueue((prev) => [...prev, req]);
  }, []);

  const closeTop = useCallback((value: boolean | void) => {
    setQueue((prev) => {
      const [top, ...rest] = prev;
      top?.resolve(value);
      return rest;
    });
  }, []);

  const handlers = useMemo(
    () => ({
      confirm: (message: string, title = "Please Confirm") =>
        new Promise<boolean>((resolve) =>
          push({ kind: "confirm", title, message, resolve: (v) => resolve(Boolean(v)) })
        ),
      alert: (message: string, title = "Notice") =>
        new Promise<void>((resolve) =>
          push({ kind: "alert", title, message, resolve: () => resolve() })
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

  return (
    <>
      {children}
      {top ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-[#2E7BBF]/30 p-4 backdrop-blur-[2px]">
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_80px_-25px_rgba(30,41,59,0.45)]">
            <div className="px-8 pt-8 pb-5 text-center">
              <h3 className="text-xl font-semibold text-slate-800">{top.title}</h3>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{top.message}</p>
            </div>
            <div className="flex items-center justify-center gap-3 px-8 pb-8">
              {top.kind === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={() => closeTop(false)}
                    className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTop(true)}
                    className="rounded-lg bg-[#2E7BBF] px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-[#2E7BBF]/30 transition hover:bg-[#256aa3]"
                  >
                    Yes, Continue
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => closeTop(true)}
                  className="rounded-lg bg-[#2E7BBF] px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-[#2E7BBF]/30 transition hover:bg-[#256aa3]"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
