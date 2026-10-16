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
    "inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[14px] px-[17px] py-[11px] text-[13px] font-semibold tracking-tight " +
    "transition-all duration-200 ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0497D8]/40 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-45";

  const styles =
    variant === "primary"
      ? "border border-transparent bg-[#0A2347] text-white shadow-[0_5px_14px_-8px_rgba(10,35,71,0.5)] hover:bg-[#11427F]"
      : "border border-white/80 bg-white/80 text-[#07182F] shadow-[0_1px_1px_rgba(7,24,47,0.04),0_10px_30px_-14px_rgba(7,24,47,0.28)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(7,24,47,0.06),0_26px_50px_-20px_rgba(7,24,47,0.4)]";

  return (
    <button type="button" className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
