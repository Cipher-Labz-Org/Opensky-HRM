"use client";

import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from "react";
import React from "react";
import Link from "next/link";
import { CompanyLogoDisplay } from "@/components/branding/CompanyLogoDisplay";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { useAuth } from "../../contexts/auth-context";
import { resolveAuthApiPath } from "../../config/constants";
import { ROUTES } from "../../config/routes";
import { resolveCompanyLogoSrc, parseLogoDisplaySettings } from "@/lib/company-branding";

type Branding = {
  companyName: string;
  companyLogoUrl: string | null;
  loginLogoScale: number;
  loginLogoOffsetX: number;
  loginLogoOffsetY: number;
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
    loginLogoScale: 100,
    loginLogoOffsetX: 0,
    loginLogoOffsetY: 0,
  });
  const [rememberMe, setRememberMe] = useState(false);
  const companyLogoSrc = resolveCompanyLogoSrc(branding.companyLogoUrl);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("opensky.rememberedUsername");
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    }
  }, []);

  useEffect(() => {
    if (LOGIN_BACKGROUND_IMAGES.length > 0) setLoginBgFailed(false);
  }, [motivationSlide]);

  useEffect(() => {
    let isMounted = true;
    const brandingUrl = resolveAuthApiPath("/api/auth/branding");
    fetch(brandingUrl)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: {
        companyName?: string;
        companyLogoUrl?: string;
        loginLogoScale?: number;
        loginLogoOffsetX?: number;
        loginLogoOffsetY?: number;
        loginLogoFit?: string;
      } | null) => {
        if (!isMounted || !data) return;
        const display = parseLogoDisplaySettings(data);
        setBranding({
          companyName: (data.companyName ?? "").trim(),
          companyLogoUrl: data.companyLogoUrl?.trim() ? data.companyLogoUrl : null,
          loginLogoScale: display.scale,
          loginLogoOffsetX: display.offsetX,
          loginLogoOffsetY: display.offsetY,
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
      if (rememberMe) {
        localStorage.setItem("opensky.rememberedUsername", username);
      } else {
        localStorage.removeItem("opensky.rememberedUsername");
      }
      window.location.replace(profile.mustChangePassword === true ? ROUTES.changePassword : "/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden bg-gradient-to-tr from-[#f0f4f8] via-[#f7fafc] to-[#eef5fa] flex items-center justify-center font-sans">
      
      {/* Background Graphic - diagonal waves: high on the left, fading toward bottom-right */}
      <div
        className="absolute bottom-0 left-0 w-full h-[48%] md:h-[55%] pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1000 400"
          className="absolute bottom-0 left-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0c3882" />
              <stop offset="35%" stopColor="#1a76d2" />
              <stop offset="58%" stopColor="#1ab1cf" stopOpacity="0.75" />
              <stop offset="78%" stopColor="#5ba832" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#5ba832" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0a2d69" />
              <stop offset="32%" stopColor="#1565c0" />
              <stop offset="55%" stopColor="#118a99" stopOpacity="0.7" />
              <stop offset="76%" stopColor="#6cb53b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6cb53b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#08214d" />
              <stop offset="28%" stopColor="#0f52ba" />
              <stop offset="52%" stopColor="#00a4b4" stopOpacity="0.85" />
              <stop offset="72%" stopColor="#72be44" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#72be44" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveFade" x1="5%" y1="25%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="42%" stopColor="white" stopOpacity="0.95" />
              <stop offset="68%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="waveMask">
              <rect width="1000" height="400" fill="url(#waveFade)" />
            </mask>
          </defs>
          <g mask="url(#waveMask)">
            {/* Wave 1 (Back wave) */}
            <path
              d="M 0,95 C 170,78 390,195 780,325 L 1000,400 L 0,400 Z"
              fill="url(#waveGrad1)"
              opacity="0.4"
            />
            {/* Wave 2 (Middle wave) */}
            <path
              d="M 0,130 C 195,112 430,230 830,350 L 1000,400 L 0,400 Z"
              fill="url(#waveGrad2)"
              opacity="0.75"
            />
            {/* Wave 3 (Front wave) */}
            <path
              d="M 0,165 C 215,145 470,260 870,370 L 1000,400 L 0,400 Z"
              fill="url(#waveGrad3)"
            />
            {/* Topographic Lines */}
            <path
              d="M 0,85 C 175,68 400,180 790,310"
              fill="none"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1.5"
            />
            <path
              d="M 0,120 C 200,102 440,215 840,335"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1.5"
            />
            <path
              d="M 0,155 C 220,135 480,248 880,360"
              fill="none"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="1"
            />
          </g>
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[1240px] px-6 py-10 lg:py-16 flex items-center justify-center min-h-screen min-h-[100dvh]">
        <div className="grid w-full gap-12 lg:grid-cols-12 items-center">
          
          {/* Left Column: Branding, Tagline, Features, and Footer (Hidden on mobile/tablet for clean login layout) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between h-full py-4 pr-12 min-h-[580px]">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="logoBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a76d2" />
                    <stop offset="100%" stopColor="#0c3882" />
                  </linearGradient>
                  <linearGradient id="logoGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#72be44" />
                    <stop offset="100%" stopColor="#5ba832" />
                  </linearGradient>
                </defs>
                {/* Blue swoosh outer arc */}
                <path 
                  d="M 28 8 C 36 14, 36 26, 28 32 C 20 38, 8 34, 6 24 C 4 14, 12 6, 20 6" 
                  fill="none" 
                  stroke="url(#logoBlue)" 
                  strokeWidth="5" 
                  strokeLinecap="round"
                />
                {/* Green inner dot / curve */}
                <path 
                  d="M 20 16 A 4 4 0 1 1 16 20 A 4 4 0 0 1 20 16" 
                  fill="url(#logoGreen)"
                />
              </svg>
              <div className="flex items-baseline font-sans">
                <span className="text-2xl font-bold tracking-tight text-[#0c2a4d]">OPENSKY</span>
                <span className="text-xl font-bold tracking-tight text-[#72be44] ml-1">HRM</span>
              </div>
            </div>

            {/* Tagline and Description */}
            <div className="mt-8">
              <h1 className="text-[2.75rem] font-extrabold tracking-tight text-[#102a43] leading-tight font-sans">
                Empowering <span className="text-[#1e76e1]">People.</span><br />
                Elevating <span className="text-[#72be44]">Performance.</span>
              </h1>
              <p className="text-base text-[#627d98] mt-6 max-w-lg leading-relaxed font-medium">
                OpenSky HRM is your all-in-one platform to manage workforce, streamline HR operations and drive organizational success.
              </p>
            </div>

            {/* 4 Feature Items */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              {/* Item 1 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/70 backdrop-blur-md border border-white flex items-center justify-center shadow-[0_8px_20px_rgba(46,123,191,0.06)] hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 text-[#1e76e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 018.625 21c-2.34 0-4.524-.712-6.33-1.928v-.002a4.125 4.125 0 017.533-2.493M15 9.04a3.31 3.31 0 010 6.3M15 9.04a3.31 3.31 0 000-6.3M15 9.04a3.31 3.31 0 01.786 3.07M15 9.04a3.31 3.31 0 00-.786-3.07M12 9.04a3.3 3.3 0 11-6.6 0 3.3 3.3 0 016.6 0z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#102a43] mt-3 text-center leading-tight">People<br />Management</span>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/70 backdrop-blur-md border border-white flex items-center justify-center shadow-[0_8px_20px_rgba(46,123,191,0.06)] hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 text-[#1e76e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#102a43] mt-3 text-center leading-tight">Attendance<br />Tracking</span>
              </div>

              {/* Item 3 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/70 backdrop-blur-md border border-white flex items-center justify-center shadow-[0_8px_20px_rgba(46,123,191,0.06)] hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 text-[#1e76e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#102a43] mt-3 text-center leading-tight">Payroll<br />Processing</span>
              </div>

              {/* Item 4 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/70 backdrop-blur-md border border-white flex items-center justify-center shadow-[0_8px_20px_rgba(46,123,191,0.06)] hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 text-[#1e76e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-[#102a43] mt-3 text-center leading-tight">Insights &<br />Reports</span>
              </div>
            </div>

            {/* Copyright Note */}
            <p className="text-xs text-[#94a3b8] font-medium pt-8">
              &copy; 2024 OpenSky HRM. All rights reserved.
            </p>
          </div>

          {/* Right Column: Floating Login Card */}
          <div className="lg:col-span-5 w-full flex items-center justify-center">
            <div className="w-full max-w-[460px] bg-white/95 backdrop-blur-lg border border-slate-100 rounded-[28px] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] p-8 sm:p-12 transition-all duration-200">
              
              {/* Optional custom branding logo display */}
              {branding.companyLogoUrl && (
                <div className="mb-6 flex justify-center">
                  <div className="flex h-16 w-16 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                    <CompanyLogoDisplay
                      src={companyLogoSrc}
                      alt={branding.companyName || "Company Logo"}
                      fit="circle"
                      scale={branding.loginLogoScale}
                      offsetX={branding.loginLogoOffsetX}
                      offsetY={branding.loginLogoOffsetY}
                      fallbackSrc="/brand-logo.svg"
                    />
                  </div>
                </div>
              )}

              {/* Title & Subtitle */}
              <div className="text-left mb-8">
                <h2 className="text-[1.75rem] font-extrabold text-[#102a43] tracking-tight">
                  Welcome Back!
                </h2>
                <p className="text-sm text-[#627d98] font-medium mt-2">
                  {branding.companyName ? (
                    <>Sign in to access your <span className="font-semibold text-slate-800">{branding.companyName}</span> account</>
                  ) : (
                    <>Sign in to access your OpenSky HRM account</>
                  )}
                </p>
              </div>

              {/* Standard Alerts / Errors */}
              <FormErrorAlert
                message={error}
                onDismiss={() => setError("")}
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              />

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Username Field */}
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-[#102a43] uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 focus-within:border-[#1e76e1] focus-within:ring-2 focus-within:ring-[#1e76e1]/10 rounded-[14px] transition-all duration-150">
                    <span className="text-slate-400 shrink-0" aria-hidden>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
                      placeholder="Enter your username"
                      className="w-full border-0 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400 py-0.5"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-[#102a43] uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 focus-within:border-[#1e76e1] focus-within:ring-2 focus-within:ring-[#1e76e1]/10 rounded-[14px] transition-all duration-150">
                    <span className="text-slate-400 shrink-0" aria-hidden>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
                      className="w-full border-0 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-0.5"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Checkbox and Forgot Password Link */}
                <div className="flex items-center justify-between text-sm pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-[#1e76e1] focus:ring-[#1e76e1]/20 cursor-pointer"
                    />
                    <span className="text-slate-600 font-medium">Remember me</span>
                  </label>
                  
                  <Link
                    href={ROUTES.forgotPassword}
                    className="font-bold text-[#1e76e1] hover:text-[#1565c0] hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={submitting || !username || !password}
                  className="w-full py-3.5 bg-[#1e76e1] hover:bg-[#1565c0] active:scale-[0.99] text-white font-bold text-[15px] rounded-[14px] shadow-[0_8px_20px_-4px_rgba(30,118,225,0.35)] transition-all duration-150 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
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
                    "Sign In"
                  )}
                </button>
              </form>

              {/* Need help? Contact administrator */}
              <div className="text-xs text-center text-slate-500 mt-8 font-medium">
                Need help?{" "}
                <Link 
                  href={ROUTES.contact} 
                  className="font-bold text-[#1e76e1] hover:text-[#1565c0] hover:underline"
                >
                  Contact your administrator
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
