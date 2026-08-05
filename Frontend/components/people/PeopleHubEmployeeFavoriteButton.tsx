"use client";

interface PeopleHubEmployeeFavoriteButtonProps {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function PeopleHubEmployeeFavoriteButton({
  active,
  onToggle,
  size = "md",
  className = "",
}: PeopleHubEmployeeFavoriteButtonProps) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full transition ${
        active
          ? "bg-amber-100 text-amber-500 ring-1 ring-amber-200 hover:bg-amber-200/80"
          : "bg-white/95 text-slate-400 ring-1 ring-slate-200/80 hover:bg-amber-50 hover:text-amber-500 hover:ring-amber-200"
      } ${className}`.trim()}
      title={active ? "Remove from favorites" : "Add to favorites"}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={active}
    >
      <svg
        className={icon}
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.75}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}
