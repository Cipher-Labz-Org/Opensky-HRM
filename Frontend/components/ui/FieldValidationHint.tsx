"use client";

import { useEffect, useState } from "react";
import { ERROR_ALERT_DISMISS_MS } from "@/lib/use-auto-dismiss";

type FieldValidationHintProps = {
  show: boolean;
  message: string;
  depKey?: string;
};

/** Field-level validation hint — hides automatically after 5 seconds. */
export function FieldValidationHint({ show, message, depKey }: FieldValidationHintProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), ERROR_ALERT_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [show, depKey]);

  if (!show || !visible) return null;

  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}
