"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { useAuth } from "../../contexts/auth-context";
import { getAssetBaseUrl, resolveAuthApiPath } from "../../config/constants";
import { ROUTES } from "../../config/routes";

type Branding = {
  companyName: string;
  companyLogoUrl: string | null;
};

const LOGIN_MOTIVATION_SLIDES: readonly { headline: string; sub: string }[] = [
  { headline: "People-first HR, built for teams that move fast.", sub: "Let's get connected." },
  { headline: "Small wins today build trust across your whole organization.", sub: "Show up for your people." },
  { headline: "Clarity beats complexity — simplify how work gets done.", sub: "One workspace, one source of truth." },
  { headline: "Great teams grow when feedback is fair, fast, and kind.", sub: "Lead with empathy." },
  { headline: "Every accurate record is a gift to your future self.", sub: "Good data, better decisions." },
  { headline: "Time saved on admin is time returned to strategy.", sub: "Automate the routine." },
  { headline: "Culture is what you celebrate and what you tolerate.", sub: "Shape it deliberately." },
  { headline: "When people feel seen, they bring their best work.", sub: "Recognition matters." },
];

const LOGIN_QUOTE_SESSION_KEY = "opensky.loginQuoteIndex";

const THEME = {
  navy: "#081F3E",
  navyMid: "#1E3A8A",
  navyDeep: "#0A2540",
  accent: "#76B82A",
  accentSoft: "#EEF6E4",
  background: "#F4F8FC",
  surface: "#ffffff",
  primaryLight: "#E8EEF7",
  border: "#D4DEE8",
  muted: "#5B7087",
} as const;

const PREVIEW_STATS = [
  { label: "Employees", value: "248" },
  { label: "Present today", value: "92%" },
  { label: "Pending leave", value: "12" },
] as const;

/**
 * OpenSky-branded sign-in (landing palette: navy + green on soft blue background).
 */
export function LoginLandingExperience() {
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [motivationSlide, setMotivationSlide] = useState(-1);
  const loginQuotePickCommittedRef = useRef(false);
  const [branding, setBranding] = useState<Branding>({
    companyName: "",
    companyLogoUrl: null,
  });
  const rawLogo = branding.companyLogoUrl?.trim() ?? "";
  const companyLogoSrc = rawLogo
    ? /^https?:\/\//i.test(rawLogo)
      ? rawLogo
      : `${getAssetBaseUrl()}${rawLogo}`
    : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const brandingUrl = resolveAuthApiPath("/api/auth/branding");
    fetch(brandingUrl)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: { companyName?: string; companyLogoUrl?: string } | null) => {
        if (!isMounted || !data) return;
        setBranding({
          companyName: (data.companyName ?? "").trim(),
          companyLogoUrl: data.companyLogoUrl?.trim() ? data.companyLogoUrl : null,
        });
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;
    window.location.replace(user.mustChangePassword === true ? ROUTES.changePassword : "/app/dashboard");
  }, [isAuthenticated, isLoading, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !mounted || isAuthenticated) return;
    if (loginQuotePickCommittedRef.current) return;
    loginQuotePickCommittedRef.current = true;
    const n = LOGIN_MOTIVATION_SLIDES.length;
    const stored = sessionStorage.getItem(LOGIN_QUOTE_SESSION_KEY);
    const prev = stored != null ? parseInt(stored, 10) : NaN;
    const safePrev = Number.isFinite(prev) && prev >= 0 ? prev : -1;
    const next = (safePrev + 1) % n;
    sessionStorage.setItem(LOGIN_QUOTE_SESSION_KEY, String(next));
    setMotivationSlide(next);
  }, [mounted, isAuthenticated]);

  if (!mounted || isAuthenticated) {
    return (
      <div
        className="flex min-h-screen min-h-[100dvh] items-center justify-center"
        style={{ backgroundColor: THEME.background }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-[#D4DEE8]"
          style={{ borderTopColor: THEME.accent }}
        />
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await login(username, password);
      window.location.replace(profile.mustChangePassword === true ? ROUTES.changePassword : "/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden"
      style={{
        backgroundColor: THEME.background,
        backgroundImage:
          "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(30,58,138,0.08), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(118,184,42,0.06), transparent 45%), linear-gradient(180deg, #F4F8FC 0%, #EEF4FA 100%)",
      }}
    >
      <div className="relative z-10 flex min-h-screen min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-8">
        <main className="grid w-full max-w-[960px] overflow-hidden rounded-[28px] border border-[#D4DEE8] bg-white shadow-[0_24px_64px_rgba(8,31,62,0.12)] md:min-h-[min(540px,88vh)] md:grid-cols-[1.05fr_0.95fr]">
          {/* Left — sign-in form */}
          <div className="flex flex-col justify-center px-8 py-10 sm:px-11 sm:py-12">
            <div className="mb-8">
              <Image
                src="/opensky-hrm-logo.png"
                alt="OpenSky HRM"
                width={220}
                height={56}
                className="h-12 w-auto object-contain sm:h-14"
                priority
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: THEME.accent }} aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.muted }}>
                {branding.companyName || "Welcome back"}
              </span>
            </div>
            <h1
              className="mt-2 text-[1.65rem] font-bold tracking-tight sm:text-[1.85rem]"
              style={{ color: THEME.navy }}
            >
              Sign in
            </h1>
            <p className="mt-2 text-sm" style={{ color: THEME.muted }}>
              {branding.companyName ? (
                <>
                  Access your <span className="font-semibold" style={{ color: THEME.navyMid }}>{branding.companyName}</span> workspace
                </>
              ) : (
                "Enter your credentials to access your workspace"
              )}
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <FormErrorAlert
                message={error}
                onDismiss={() => setError("")}
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              />

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium" style={{ color: THEME.muted }}>
                    Username or email
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-[#76B82A]"
                    style={{ borderColor: THEME.border, backgroundColor: THEME.surface }}
                  >
                    <span style={{ color: THEME.accent }} aria-hidden>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="Enter your email or username"
                      className="w-full border-0 bg-transparent py-1 text-[15px] outline-none placeholder:text-[#94A3B8]"
                      style={{ color: THEME.navy }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-medium" style={{ color: THEME.muted }}>
                    Password
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-[#76B82A]"
                    style={{ borderColor: THEME.border, backgroundColor: THEME.surface }}
                  >
                    <span style={{ color: THEME.accent }} aria-hidden>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full border-0 bg-transparent py-1 text-[15px] outline-none placeholder:text-[#94A3B8]"
                      style={{ color: THEME.navy }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="shrink-0 text-xs font-semibold uppercase tracking-wide hover:opacity-80"
                      style={{ color: THEME.navyMid }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 mt-4 text-right">
                <Link
                  href={ROUTES.forgotPassword}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: THEME.navyMid }}
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={submitting || !username || !password}
                className="h-[50px] w-full rounded-2xl text-[15px] font-bold tracking-wide text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  backgroundColor: THEME.accent,
                  boxShadow: submitting || !username || !password ? "none" : "0 8px 24px rgba(118,184,42,0.35)",
                }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <p className="mt-8 text-sm" style={{ color: THEME.muted }}>
              Need access?{" "}
              <Link href={ROUTES.contact} className="font-semibold hover:underline" style={{ color: THEME.navyMid }}>
                Contact us
              </Link>
            </p>
          </div>

          {/* Right — navy welcome panel (landing-style) */}
          <div
            className="relative isolate flex min-h-[300px] flex-col overflow-hidden md:min-h-0"
            style={{
              background: `linear-gradient(165deg, ${THEME.navyDeep} 0%, ${THEME.navy} 45%, ${THEME.navyMid} 100%)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 15%, rgba(118,184,42,0.35) 0, transparent 42%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.12) 0, transparent 38%)",
              }}
              aria-hidden
            />

            <div className="relative z-10 flex flex-1 flex-col px-8 py-10 sm:px-10 sm:py-12 md:min-h-[min(540px,88vh)]">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                <span className="text-[#76B82A]" aria-hidden>
                  ★
                </span>
                Latest product by OpenSky
              </div>

              <div className="mt-8 flex flex-1 flex-col justify-center">
                <div className="mb-6 flex shrink-0 justify-center md:justify-start">
                  <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- tenant logo may be external URL */}
                    <img
                      src={companyLogoSrc || "/opensky-hrm-logo.png"}
                      alt={branding.companyName || "OpenSky HRM"}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <p className="text-center text-[2rem] font-bold leading-tight tracking-tight text-white md:text-left md:text-[2.15rem]">
                  People-first HR, built for teams that move fast.
                </p>

                {motivationSlide >= 0 ? (
                  <div
                    key={motivationSlide}
                    className="login-quote-slide mt-5 max-w-md md:text-left"
                    role="region"
                    aria-label="Welcome message"
                  >
                    <p className="text-base font-semibold leading-snug text-white/95 sm:text-lg">
                      {LOGIN_MOTIVATION_SLIDES[motivationSlide].headline}
                    </p>
                    <p className="mt-2 text-sm text-white/75 sm:text-base">
                      {LOGIN_MOTIVATION_SLIDES[motivationSlide].sub}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 max-w-md space-y-3" aria-hidden>
                    <div className="h-6 w-full max-w-[280px] rounded-md bg-white/15" />
                    <div className="h-4 w-[70%] max-w-[220px] rounded-md bg-white/10" />
                  </div>
                )}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
                {PREVIEW_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-center backdrop-blur-sm"
                  >
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70 sm:text-[11px]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
