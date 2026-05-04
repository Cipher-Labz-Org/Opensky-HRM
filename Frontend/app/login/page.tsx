"use client";

import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";

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

/** One curated Unsplash image per slide — advances with the quote on each visit. */
const LOGIN_BACKGROUND_IMAGES: readonly string[] = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1600880292203-75762962e04b?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1920&h=1080&q=80&auto=format&fit=max",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1920&h=1080&q=80&auto=format&fit=max",
];

/** sessionStorage key — each full page load shows the next quote (no auto-rotation). */
const LOGIN_QUOTE_SESSION_KEY = "opensky.loginQuoteIndex";

const pageBackdropStyle: CSSProperties = {
  backgroundColor: "#e8f1f9",
  backgroundImage:
    "radial-gradient(ellipse 100% 80% at 50% -20%, rgba(26,146,213,0.18), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(46,123,191,0.12), transparent 45%), linear-gradient(165deg, #eef5fb 0%, #e2edf7 50%, #d8e8f4 100%)",
};

export default function LoginPage() {
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** -1 until client picks index after mount (avoids SSR/client random mismatch). */
  const [motivationSlide, setMotivationSlide] = useState(-1);
  /** Avoid double sessionStorage advance when React Strict Mode runs effects twice in dev. */
  const loginQuotePickCommittedRef = useRef(false);
  const [branding, setBranding] = useState<Branding>({
    companyName: "",
    companyLogoUrl: null,
  });
  const rawLogo = branding.companyLogoUrl?.trim() ?? "";
  const companyLogoSrc = rawLogo
    ? /^https?:\/\//i.test(rawLogo)
      ? rawLogo
      : `${API_BASE_URL}${rawLogo}`
    : null;

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE_URL}/api/auth/branding`)
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
    if (typeof window === "undefined" || isLoading || isAuthenticated) return;
    if (loginQuotePickCommittedRef.current) return;
    loginQuotePickCommittedRef.current = true;
    const n = LOGIN_MOTIVATION_SLIDES.length;
    const stored = sessionStorage.getItem(LOGIN_QUOTE_SESSION_KEY);
    const prev = stored != null ? parseInt(stored, 10) : NaN;
    const safePrev = Number.isFinite(prev) && prev >= 0 ? prev : -1;
    const next = (safePrev + 1) % n;
    sessionStorage.setItem(LOGIN_QUOTE_SESSION_KEY, String(next));
    setMotivationSlide(next);
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
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

  const loginBgSlide =
    motivationSlide >= 0 ? motivationSlide % LOGIN_BACKGROUND_IMAGES.length : 0;
  const loginBackdropImage = LOGIN_BACKGROUND_IMAGES[loginBgSlide];

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-x-hidden">
      {/* Full-bleed: blurred cover fills edges; sharp contain shows more of the frame (between cover & contain). */}
      <div
        key={loginBgSlide}
        className="login-bg-layer pointer-events-none fixed inset-0 -z-20 overflow-hidden bg-[#cfe4f4]"
        aria-hidden
      >
        <div
          className="absolute -inset-[10%] bg-cover bg-center opacity-[0.58] blur-xl"
          style={{ backgroundImage: `url(${loginBackdropImage})` }}
        />
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${loginBackdropImage})` }}
        />
      </div>
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-slate-950/22 backdrop-blur-md"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-slate-800/25 via-slate-700/10 to-[#0c4a6e]/30"
        aria-hidden
      />

      <div className="relative z-0 flex min-h-screen min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-8">
        <main className="grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-white/50 bg-white/10 shadow-[0_32px_80px_rgba(15,23,42,0.35)] backdrop-blur-sm md:min-h-[min(560px,88vh)] md:grid-cols-2 md:rounded-[28px]">
          {/* Left — glass login */}
          <div className="flex flex-col justify-center border-b border-white/25 bg-white/50 px-8 py-10 backdrop-blur-2xl sm:px-12 sm:py-14 md:border-b-0 md:border-r md:border-white/30 md:bg-white/45">
            <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-left sm:text-3xl">
              Let&apos;s sign in
            </h1>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[#1a92d5] sm:mx-0" aria-hidden />

            <p className="mt-4 text-center text-sm text-slate-600 sm:text-left">
              {branding.companyName ? (
                <>Sign in to <span className="font-semibold text-slate-800">{branding.companyName}</span></>
              ) : (
                <>Sign in to your OpenSky HRM workspace</>
              )}
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-3 transition-colors focus-within:border-[#1a92d5]">
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
                  className="w-full border-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-3 transition-colors focus-within:border-[#1a92d5]">
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
                  className="w-full border-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0 text-xs font-semibold text-[#2E7BBF] hover:text-[#1a92d5]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="mb-6 text-right">
              <a href="#" className="text-sm font-semibold text-[#1a92d5] hover:text-[#157fc0] hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="h-[52px] w-full rounded-full bg-gradient-to-r from-[#1a92d5] to-[#2E7BBF] text-[15px] font-bold tracking-wide text-white shadow-[0_10px_28px_rgba(26,146,213,0.35)] transition hover:from-[#157fc0] hover:to-[#256aa3] hover:shadow-[0_12px_32px_rgba(26,146,213,0.4)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
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

        {/* Right — logo + welcome + quote (brand panel) */}
        <div className="relative isolate flex min-h-[300px] flex-col overflow-hidden md:min-h-0">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#4a8bc8] via-[#42a5e8] to-[#2E7BBF]"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(118deg, transparent 0, transparent 14px, rgba(255,255,255,0.06) 14px, rgba(255,255,255,0.06) 15px)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 22% 28%, rgba(255,255,255,0.55) 0, transparent 46%), radial-gradient(circle at 78% 72%, rgba(255,255,255,0.35) 0, transparent 42%)",
            }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1a4d7a]/35 via-transparent to-white/20"
            aria-hidden
          />

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-12 text-center sm:px-10 sm:py-14 md:min-h-[min(520px,88vh)] md:py-16">
            <div className="mb-8 flex shrink-0 justify-center sm:mb-10">
              <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/30 p-3 shadow-[0_14px_36px_rgba(15,76,120,0.22)] ring-1 ring-white/50 backdrop-blur-md sm:h-[100px] sm:w-[100px]">
                {companyLogoSrc ? (
                  <img
                    src={companyLogoSrc}
                    alt={branding.companyName || "Company logo"}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <img src="/brand-mark.svg" alt="OpenSky HRM" className="h-14 w-14 object-contain opacity-95 drop-shadow-md" />
                )}
              </div>
            </div>

            <p className="mb-8 font-sans text-4xl font-bold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:mb-10 sm:text-5xl">
              Welcome back
            </p>

            {motivationSlide >= 0 ? (
              <div
                key={motivationSlide}
                className="login-quote-slide mt-2 max-w-sm md:mt-4"
                role="region"
                aria-label="Motivation"
              >
                <p className="text-xl font-semibold leading-snug text-white/95 drop-shadow-sm sm:text-2xl">
                  {LOGIN_MOTIVATION_SLIDES[motivationSlide].headline}
                </p>
                <p className="mt-4 text-sm font-medium text-white/85 sm:mt-5 sm:text-base">
                  {LOGIN_MOTIVATION_SLIDES[motivationSlide].sub}
                </p>
              </div>
            ) : (
              <div className="mt-2 max-w-sm space-y-3 md:mt-4" aria-hidden>
                <div className="mx-auto h-7 w-full max-w-[280px] rounded-md bg-white/15" />
                <div className="mx-auto h-5 w-[80%] max-w-[220px] rounded-md bg-white/10" />
              </div>
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
