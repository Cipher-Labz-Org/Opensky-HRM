"use client";

import { useEffect, useRef } from "react";
import { scrollAlertIntoView } from "@/lib/scroll-alert-into-view";

type InlinePageAlertProps = {
  message: string | null | undefined | false;
  variant?: "error" | "success";
  className?: string;
};

const VARIANT_CLASSES: Record<NonNullable<InlinePageAlertProps["variant"]>, string> = {
  error: "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
  success: "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700",
};

/** Page-level inline feedback — scrolls into view when shown after save/update/delete. */
export function InlinePageAlert({
  message,
  variant = "error",
  className,
}: InlinePageAlertProps) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message) return;
    scrollAlertIntoView(alertRef.current);
  }, [message]);

  if (!message) return null;

  return (
    <div ref={alertRef} className={`scroll-mt-20 ${className ?? VARIANT_CLASSES[variant]}`} role="alert">
      {message}
    </div>
  );
}
