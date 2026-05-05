/** Logo mark using shapes only (no SVG text) — always visible inline. */
export function OpenSkyOrbMark({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" className={className} aria-hidden fill="none">
      <rect x="5" y="5" width="46" height="46" rx="12" fill="#f5f6f8" stroke="#d9dee6" strokeWidth="1.25" />
      <circle cx="22.5" cy="28" r="9.5" fill="#e11d48" />
      <circle cx="35.5" cy="28" r="9.5" fill="#2c79b8" />
    </svg>
  );
}
