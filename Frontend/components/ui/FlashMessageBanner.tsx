"use client";

import { useCallback, useEffect, useRef } from "react";
import { scrollAlertIntoView } from "@/lib/scroll-alert-into-view";
import {
  ERROR_ALERT_DISMISS_MS,
  SUCCESS_ALERT_DISMISS_MS,
  SUCCESS_BANNER_DISMISS_MS,
  useAutoDismiss,
} from "@/lib/use-auto-dismiss";

export type FlashMessage = { type: "ok" | "err"; text: string };

type FlashMessageBannerProps = {
  msg: FlashMessage | null;
  onClear: () => void;
  className?: string;
  /** Override auto-dismiss duration in milliseconds. */
  dismissMs?: number;
};

export function FlashMessageBanner({
  msg,
  onClear,
  className = "mb-4",
  dismissMs,
}: FlashMessageBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => onClear(), [onClear]);

  const autoDismissMs =
    dismissMs ??
    (msg?.type === "err" ? ERROR_ALERT_DISMISS_MS : SUCCESS_ALERT_DISMISS_MS);

  useAutoDismiss(!!msg, dismiss, autoDismissMs, msg?.text);

  useEffect(() => {
    if (!msg) return;
    scrollAlertIntoView(bannerRef.current);
  }, [msg]);

  if (!msg) return null;

  const ok = msg.type === "ok";

  return (
    <div ref={bannerRef} className={`scroll-mt-20 ${className}`}>
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
        role="alert"
      >
        {msg.text}
      </div>
    </div>
  );
}

export { SUCCESS_BANNER_DISMISS_MS };
