import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

/**
 * Glass-style actions aligned with People Hub “New Employee”:
 * frosted white, light border, #2B7DE9 accent on primary.
 */
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-[42px] items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold tracking-tight " +
    "backdrop-blur-md transition-all duration-200 ease-out " +
    "shadow-sm shadow-slate-900/[0.04] ring-1 ring-inset ring-white/60 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B7DE9]/30 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]";

  const styles =
    variant === "primary"
      ? "border border-slate-200/90 bg-white/80 text-[#2B7DE9] hover:border-[#2B7DE9] hover:bg-white/95 hover:shadow-md hover:shadow-[#2B7DE9]/12"
      : "border border-slate-200/90 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white/90 hover:text-slate-900 hover:shadow";

  return (
    <button type="button" className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
