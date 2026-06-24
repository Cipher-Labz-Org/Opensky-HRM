"use client";

import { useEffect } from "react";

/** Auto-invokes `onDismiss` after `ms` while `active` is true; resets when `active` or `depKey` changes. */
export function useAutoDismiss(
  active: boolean,
  onDismiss: () => void,
  ms = 5000,
  depKey?: string | number,
) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(timer);
  }, [active, onDismiss, ms, depKey]);
}

export const ERROR_ALERT_DISMISS_MS = 5000;
export const SUCCESS_ALERT_DISMISS_MS = 5000;
