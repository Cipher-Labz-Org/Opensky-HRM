import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

/**
 * Glass-style actions aligned with People Hub “New Employee”:
 * frosted white, light border, OpenSky blue (#2E7BBF) accent on primary.
 */
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-[42px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold tracking-tight " +
    "transition-all duration-200 ease-out " +
    "shadow-sm shadow-slate-900/[0.04] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7BBF]/30 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]";

  const styles =
    variant === "primary"
      ? "border border-[#2E7BBF] bg-[#2E7BBF] text-white hover:border-[#256aa3] hover:bg-[#256aa3] hover:shadow-md hover:shadow-[#2E7BBF]/18"
      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow";

  return (
    <button type="button" className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
