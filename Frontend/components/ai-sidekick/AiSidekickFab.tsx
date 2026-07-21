"use client";

import { useAiSidekickOptional } from "@/components/ai-sidekick/AiSidekickProvider";

function AiGradientSparkleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="opensky-ai-star-main" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="28%" stopColor="#eab308" />
          <stop offset="52%" stopColor="#f97316" />
          <stop offset="76%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="opensky-ai-star-small" x1="14" y1="2" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <path
        fill="url(#opensky-ai-star-main)"
        d="M12 2.25 13.05 6.8 17.6 7.85 13.05 8.9 12 13.45 10.95 8.9 6.4 7.85 10.95 6.8 12 2.25Z"
      />
      <path
        fill="url(#opensky-ai-star-small)"
        d="M18.25 3.5 18.7 5.35 20.55 5.8 18.7 6.25 18.25 8.1 17.8 6.25 15.95 5.8 17.8 5.35 18.25 3.5Z"
      />
    </svg>
  );
}

export function AiSidekickFab() {
  const sidekick = useAiSidekickOptional();
  if (!sidekick || sidekick.open) return null;

  return (
    <button
      type="button"
      onClick={sidekick.toggle}
      aria-label="Open OpenSky AI"
      title="OpenSky AI"
      aria-pressed={false}
      className="ai-sidekick-fab"
    >
      <span className="ai-sidekick-fab__inner">
        <AiGradientSparkleIcon />
      </span>
    </button>
  );
}
