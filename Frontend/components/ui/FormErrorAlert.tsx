"use client";

import { useCallback, useEffect, useState } from "react";
import { ERROR_ALERT_DISMISS_MS, useAutoDismiss } from "@/lib/use-auto-dismiss";

type FormErrorAlertProps = {
  message: string | null | undefined | false;
  onDismiss: () => void;
  className?: string;
};

/** Inline / modal validation error — auto-clears after 5 seconds. */
export function FormErrorAlert({
  message,
  onDismiss,
  className = "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600",
}: FormErrorAlertProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) setVisible(true);
  }, [message]);

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);

  useAutoDismiss(
    Boolean(message) && visible,
    dismiss,
    ERROR_ALERT_DISMISS_MS,
    typeof message === "string" ? message : undefined,
  );

  if (!message || !visible) return null;

  return (
    <div className={className} role="alert">
      {message}
    </div>
  );
}
