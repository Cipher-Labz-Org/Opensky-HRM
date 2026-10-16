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
      className={`rounded-[22px] border border-white/80 bg-white/80 p-5 shadow-[0_1px_1px_rgba(7,24,47,0.04),0_10px_30px_-14px_rgba(7,24,47,0.28)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
