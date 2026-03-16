import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
};

/**
 * Reusable button. Primary and secondary variants from hris_ui_pack.
 */
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "rounded-[14px] px-4 py-3 text-sm font-semibold shadow-[var(--shadow)] disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-[var(--primary)] text-white"
      : "border border-[var(--border)] bg-white text-[var(--text)]";

  return (
    <button
      type="button"
      className={`${base} ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
