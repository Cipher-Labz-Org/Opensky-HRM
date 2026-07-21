"use client";

import { OPENSKY_THEME } from "@/lib/opensky-theme";

const T = OPENSKY_THEME;

const PRODUCT_PILLARS = [
  {
    label: "Leave & time off",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
    tone: T.action,
  },
  {
    label: "Attendance",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tone: T.accent,
  },
  {
    label: "People & payroll",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
    tone: "#93C5FD",
  },
] as const;

interface LoginWelcomePanelProps {
  companyLogoSrc: string;
  companyName: string;
  headline: string;
  sub: string;
  quoteReady: boolean;
}

export function LoginWelcomePanel({
  companyLogoSrc,
  companyName,
  headline,
  sub,
  quoteReady,
}: LoginWelcomePanelProps) {
  return (
    <div
      className="login-welcome-panel relative isolate flex min-h-[320px] flex-col overflow-hidden md:min-h-0"
      style={{
        background: `linear-gradient(155deg, ${T.navyDeep} 0%, ${T.navy} 42%, ${T.navyMid} 100%)`,
      }}
    >
      {/* Mesh + texture */}
      <div className="login-welcome-mesh pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="login-orb login-orb-a pointer-events-none absolute rounded-full"
        style={{ background: `radial-gradient(circle, ${T.action}55 0%, transparent 70%)` }}
        aria-hidden
      />
      <div
        className="login-orb login-orb-b pointer-events-none absolute rounded-full"
        style={{ background: `radial-gradient(circle, ${T.accent}44 0%, transparent 70%)` }}
        aria-hidden
      />
      <div
        className="login-orb login-orb-c pointer-events-none absolute rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)" }}
        aria-hidden
      />

      {/* Decorative rings */}
      <div className="login-ring login-ring-a pointer-events-none absolute rounded-full border border-white/10" aria-hidden />
      <div className="login-ring login-ring-b pointer-events-none absolute rounded-full border border-white/5" aria-hidden />

      <div className="relative z-10 flex flex-1 flex-col px-8 py-10 sm:px-10 sm:py-12 md:min-h-[min(540px,88vh)]">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ backgroundColor: T.accent, color: "#fff" }}>
            ★
          </span>
          People-first HR by OpenSky
        </div>

        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center md:items-start md:text-left">
          {/* Logo halo */}
          <div className="relative mb-8">
            <div
              className="absolute -inset-3 rounded-[28px] opacity-80"
              style={{
                background: `linear-gradient(135deg, ${T.action}66, ${T.accent}55)`,
                filter: "blur(18px)",
              }}
              aria-hidden
            />
            <div
              className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-[22px] border border-white/20 bg-white/95 p-3 backdrop-blur-md"
              style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.8)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tenant logo may be external URL */}
              <img
                src={companyLogoSrc}
                alt={companyName || "OpenSky HRM"}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>

          {quoteReady ? (
            <div key={headline} className="login-quote-slide max-w-[340px]" role="region" aria-label="Welcome message">
              <p className="text-[1.35rem] font-bold leading-snug tracking-tight text-white sm:text-[1.5rem]">
                {headline}
              </p>
              <div
                className="mx-auto mt-3 h-1 w-12 rounded-full md:mx-0"
                style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.action})` }}
                aria-hidden
              />
              <p className="mt-4 text-sm leading-relaxed text-white/72 sm:text-[15px]">{sub}</p>
            </div>
          ) : (
            <div className="max-w-[340px] space-y-3" aria-hidden>
              <div className="mx-auto h-7 w-full max-w-[300px] rounded-lg bg-white/15 md:mx-0" />
              <div className="mx-auto h-4 w-[75%] max-w-[220px] rounded-lg bg-white/10 md:mx-0" />
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PRODUCT_PILLARS.map((pillar) => (
            <div
              key={pillar.label}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 backdrop-blur-sm transition hover:bg-white/[0.11]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: `${pillar.tone}33`, color: pillar.tone }}
              >
                {pillar.icon}
              </span>
              <span className="text-left text-[11px] font-semibold leading-tight text-white/88 sm:text-xs">
                {pillar.label}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/40 md:text-left">
          Secure · Cloud · Built for growing teams
        </p>
      </div>
    </div>
  );
}
