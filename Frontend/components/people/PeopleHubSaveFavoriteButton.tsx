"use client";

interface PeopleHubSaveFavoriteButtonProps {
  saved: boolean;
  onClick: () => void;
  compact?: boolean;
}

export function PeopleHubSaveFavoriteButton({
  saved,
  onClick,
  compact = false,
}: PeopleHubSaveFavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition ${
        compact
          ? "px-2.5 py-1.5 text-[11px]"
          : "px-3.5 py-2 text-[12px] shadow-sm"
      } ${
        saved
          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200/80"
          : "bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
      }`}
    >
      <svg
        className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={saved ? 0 : 1.75}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
      {saved ? "Saved to favorites" : "Add to favorites"}
    </button>
  );
}
