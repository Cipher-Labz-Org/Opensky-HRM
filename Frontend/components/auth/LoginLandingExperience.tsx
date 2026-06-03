"use client";

import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from "react";
import React from "react";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { getApiBaseUrl, getAssetBaseUrl } from "../../config/constants";
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

/**
 * Optional carousel under `public/login-bg/`. Files are not in git by default — set
 * NEXT_PUBLIC_LOGIN_BG_IMAGES=1 after adding 01.jpg–10.jpg to enable.
 */
const LOGIN_BACKGROUND_IMAGES: readonly string[] =
  process.env.NEXT_PUBLIC_LOGIN_BG_IMAGES === "1"
    ? [
        "/login-bg/01.jpg",
        "/login-bg/02.jpg",
        "/login-bg/03.jpg",
        "/login-bg/04.jpg",
        "/login-bg/05.jpg",
        "/login-bg/06.jpg",
        "/login-bg/07.jpg",
        "/login-bg/08.jpg",
        "/login-bg/09.jpg",
        "/login-bg/10.jpg",
      ]
    : [];

const LOGIN_QUOTE_SESSION_KEY = "opensky.loginQuoteIndex";

const pageBackdropStyle: CSSProperties = {
  backgroundColor: "#e8f1f9",
  backgroundImage:
    "radial-gradient(ellipse 100% 80% at 50% -20%, rgba(26,146,213,0.18), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(46,123,191,0.12), transparent 45%), linear-gradient(165deg, #eef5fb 0%, #e2edf7 50%, #d8e8f4 100%)",
};

/**
 * Two-column glass + gradient sign-in (landing reference). Shared by `/` and `/login`.
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
  const [loginBgFailed, setLoginBgFailed] = useState(LOGIN_BACKGROUND_IMAGES.length === 0);
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
    if (LOGIN_BACKGROUND_IMAGES.length > 0) setLoginBgFailed(false);
  }, [motivationSlide]);

  useEffect(() => {
    let isMounted = true;
    const apiBase =
      typeof window !== "undefined" ? getApiBaseUrl().replace(/\/$/, "") : "";
    const brandingUrl = apiBase ? `${apiBase}/api/auth/branding` : "/api/auth/branding";
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

  if (!mounted) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center" style={pageBackdropStyle}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#b8d4ef] border-t-[#1a92d5]" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center" style={pageBackdropStyle}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#b8d4ef] border-t-[#1a92d5]" />
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

  const loginBgSlide = motivationSlide >= 0 ? motivationSlide % LOGIN_BACKGROUND_IMAGES.length : 0;
  const loginBackdropImage = LOGIN_BACKGROUND_IMAGES[loginBgSlide];

  return (
    <div className="relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#e8f2fa]">
      {/*
        Use non-negative z-index inside `isolate` so layers paint above body — negative z-index
        on fixed elements can sit behind the root/body paint and disappear entirely.
      */}
      <div key={loginBgSlide} className="login-bg-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#dfeaf5]" />
        {!loginBgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- full-bleed static asset from /public
          <img
            src={loginBackdropImage}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.03] transform object-cover object-center blur-[12px] saturate-[0.92]"
            fetchPriority={loginBgSlide === 0 ? "high" : "low"}
            decoding="async"
            onError={() => setLoginBgFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(120% 80% at 20% 20%, rgba(91,164,229,0.35), transparent 50%), radial-gradient(90% 70% at 85% 75%, rgba(58,134,202,0.28), transparent 52%), linear-gradient(165deg, #e8f2fa 0%, #dceaf6 45%, #cfe2f5 100%)",
            }}
          />
        )}
        {/* Light wash only — photo should read clearly */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-sky-50/15 to-sky-200/25" aria-hidden />
      </div>

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-8">
        <main className="grid w-full max-w-[940px] overflow-hidden rounded-[25px] border border-white/40 bg-white/5 shadow-[0_24px_64px_rgba(15,23,42,0.28)] md:min-h-[min(520px,88vh)] md:grid-cols-2 md:rounded-[25px]">
          {/* Left — glass sign-in */}
          <div className="flex flex-col justify-center border-b border-white/20 bg-white/60 px-8 py-10 backdrop-blur-[10px] sm:px-11 sm:py-12 md:border-b-0 md:border-r md:border-white/25">
            <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-left sm:text-[1.65rem]">
              Let&apos;s sign in
            </h1>
            <div className="mx-auto mt-3 h-[3px] w-12 rounded-full bg-[#1a92d5] sm:mx-0" aria-hidden />

            <p className="mt-4 text-center text-sm text-slate-600 sm:text-left">
              {branding.companyName ? (
                <>Sign in to <span className="font-semibold text-slate-800">{branding.companyName}</span></>
              ) : (
                <>Sign in to your OpenSky HRM workspace</>
              )}
            </p>

            <form onSubmit={handleSubmit} className="mt-9">
              {error && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <div className="mb-7">
                <div className="flex items-center gap-3 border-b border-[#add8e6] pb-2.5 transition-colors focus-within:border-[#1a92d5]">
                  <span className="text-[#1a92d5]" aria-hidden>
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
                    className="w-full border-0 bg-transparent py-2 text-[15px] text-slate-900 outline-none placeholder:text-[#8eb8d9]"
                  />
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-3 border-b border-[#add8e6] pb-2.5 transition-colors focus-within:border-[#1a92d5]">
                  <span className="text-[#1a92d5]" aria-hidden>
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
                    className="w-full border-0 bg-transparent py-2 text-[15px] text-slate-900 outline-none placeholder:text-[#8eb8d9]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#2E7BBF] hover:text-[#1a92d5]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="mb-7 text-right">
                <a
                  href="#"
                  className="text-sm font-semibold text-[#1a92d5] hover:text-[#157fc0] hover:underline"
                  onClick={(e) => e.preventDefault()}
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting || !username || !password}
                className="h-[50px] w-full rounded-full bg-[#3a86ca] text-[15px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(58,134,202,0.38)] transition hover:bg-[#2f75b5] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
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
                  "Login"
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600 sm:text-left">
              Need access?{" "}
              <Link href={ROUTES.contact} className="font-semibold text-[#1a92d5] hover:text-[#157fc0] hover:underline">
                Contact us
              </Link>
            </p>
          </div>

          {/* Right — welcome panel */}
          <div className="relative isolate flex min-h-[280px] flex-col overflow-hidden md:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[#5ba4e5] to-[#3a86ca]" aria-hidden />
            <div
              className="absolute inset-0 opacity-[0.2]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5) 0, transparent 45%), radial-gradient(circle at 70% 85%, rgba(255,255,255,0.28) 0, transparent 40%)",
              }}
              aria-hidden
            />

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-11 text-center sm:px-10 sm:py-14 md:min-h-[min(520px,88vh)] md:py-16">
              <div className="mb-7 flex shrink-0 justify-center sm:mb-8">
                <div className="flex h-[98px] w-[98px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,76,120,0.25)] ring-2 ring-white/70 sm:h-[108px] sm:w-[108px]">
                  <img
                    src={companyLogoSrc || "/brand-logo.svg"}
                    alt={branding.companyName || "OpenSky HRM"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              <p className="mb-6 font-sans text-[2.125rem] font-bold leading-[1.12] tracking-tight text-white drop-shadow sm:mb-7 sm:text-5xl">
                Welcome back
              </p>

              {motivationSlide >= 0 ? (
                <div key={motivationSlide} className="login-quote-slide mt-1 max-w-[18rem]" role="region" aria-label="Welcome message">
                  <p className="text-lg font-semibold leading-snug text-white drop-shadow-sm sm:text-xl">{LOGIN_MOTIVATION_SLIDES[motivationSlide].headline}</p>
                  <p className="mt-3 text-sm font-medium text-white/90 sm:text-base">{LOGIN_MOTIVATION_SLIDES[motivationSlide].sub}</p>
                </div>
              ) : (
                <div className="mt-1 max-w-[18rem] space-y-3" aria-hidden>
                  <div className="mx-auto h-7 w-full max-w-[260px] rounded-md bg-white/15" />
                  <div className="mx-auto h-4 w-[75%] max-w-[200px] rounded-md bg-white/10" />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
