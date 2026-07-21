"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { useAuth } from "../../contexts/auth-context";
import { getAssetBaseUrl, resolveAuthApiPath } from "../../config/constants";
import { ROUTES } from "../../config/routes";
import { OPENSKY_THEME, softCardShadow, softPageBackground } from "@/lib/opensky-theme";
import { LoginWelcomePanel } from "@/components/auth/LoginWelcomePanel";

type Branding = {
  companyName: string;
  companyLogoUrl: string | null;
};

const T = OPENSKY_THEME;

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

/**
 * OpenSky-branded sign-in — theme colors only (navy, green, teal on soft blue background).
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
        style={{ backgroundColor: T.background }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: T.border, borderTopColor: T.action }}
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
      style={{ backgroundColor: T.background, backgroundImage: softPageBackground }}
    >
      <div className="relative z-10 flex min-h-screen min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-8">
        <main
          className="grid w-full max-w-[960px] overflow-hidden rounded-[28px] border bg-white md:min-h-[min(540px,88vh)] md:grid-cols-[1.05fr_0.95fr]"
          style={{ borderColor: T.border, boxShadow: softCardShadow }}
        >
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
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: T.accent }} aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                {branding.companyName || "Welcome back"}
              </span>
            </div>
            <h1
              className="mt-2 text-[1.65rem] font-bold tracking-tight sm:text-[1.85rem]"
              style={{ color: T.navy }}
            >
              Sign in
            </h1>
            <p className="mt-2 text-sm" style={{ color: T.muted }}>
              {branding.companyName ? (
                <>
                  Access your{" "}
                  <span className="font-semibold" style={{ color: T.navyMid }}>
                    {branding.companyName}
                  </span>{" "}
                  workspace
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
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium" style={{ color: T.muted }}>
                    Username or email
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-[#28A9E0]"
                    style={{ borderColor: T.border, backgroundColor: T.surface }}
                  >
                    <span style={{ color: T.action }} aria-hidden>
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
                      style={{ color: T.navy }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-xs font-medium" style={{ color: T.muted }}>
                    Password
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors focus-within:border-[#28A9E0]"
                    style={{ borderColor: T.border, backgroundColor: T.surface }}
                  >
                    <span style={{ color: T.action }} aria-hidden>
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
                      style={{ color: T.navy }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="shrink-0 text-xs font-semibold uppercase tracking-wide hover:opacity-80"
                      style={{ color: T.navyMid }}
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
                  style={{ color: T.action }}
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={submitting || !username || !password}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  backgroundColor: T.action,
                  boxShadow:
                    submitting || !username || !password ? "none" : "0 8px 24px rgba(40,169,224,0.35)",
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
                  <>
                    Sign in
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-sm" style={{ color: T.muted }}>
              Need access?{" "}
              <Link href={ROUTES.contact} className="font-semibold hover:underline" style={{ color: T.navyMid }}>
                Contact us
              </Link>
            </p>
          </div>

          {/* Right — welcome hero */}
          <LoginWelcomePanel
            companyLogoSrc={companyLogoSrc || "/opensky-hrm-logo.png"}
            companyName={branding.companyName || "OpenSky HRM"}
            headline={
              motivationSlide >= 0
                ? LOGIN_MOTIVATION_SLIDES[motivationSlide].headline
                : LOGIN_MOTIVATION_SLIDES[0].headline
            }
            sub={
              motivationSlide >= 0
                ? LOGIN_MOTIVATION_SLIDES[motivationSlide].sub
                : LOGIN_MOTIVATION_SLIDES[0].sub
            }
            quoteReady={motivationSlide >= 0}
          />
        </main>
      </div>
    </div>
  );
}
