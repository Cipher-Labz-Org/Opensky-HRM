import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Reusable card container. Matches hris_ui_pack card styling.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  );
}
