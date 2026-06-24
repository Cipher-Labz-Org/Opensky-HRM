"use client";

import { useCallback } from "react";
import { ERROR_ALERT_DISMISS_MS, SUCCESS_ALERT_DISMISS_MS, useAutoDismiss } from "@/lib/use-auto-dismiss";

export type FlashMessage = { type: "ok" | "err"; text: string };

type FlashMessageBannerProps = {
  msg: FlashMessage | null;
  onClear: () => void;
  className?: string;
};

export function FlashMessageBanner({ msg, onClear, className = "mb-4" }: FlashMessageBannerProps) {
  const dismiss = useCallback(() => onClear(), [onClear]);

  useAutoDismiss(
    !!msg,
    dismiss,
    msg?.type === "err" ? ERROR_ALERT_DISMISS_MS : SUCCESS_ALERT_DISMISS_MS,
    msg?.text,
  );

  if (!msg) return null;

  const ok = msg.type === "ok";

  return (
    <div
      className={`${className} flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
      role="alert"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      {msg.text}
    </div>
  );
}
