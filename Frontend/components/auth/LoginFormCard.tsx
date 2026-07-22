"use client";

import Link from "next/link";
import { type FormEvent } from "react";
import { CompanyLogoDisplay } from "@/components/branding/CompanyLogoDisplay";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { ROUTES } from "@/config/routes";
import { resolveCompanyLogoSrc } from "@/lib/company-branding";
import { LOGIN_THEME } from "@/lib/opensky-theme";

const DEFAULT_LOGIN_LOGO = "/opensky-hrm-logo.png";

interface LoginFormCardProps {
  companyName?: string;
  companyLogoUrl?: string | null;
  loginLogoScale?: number;
  loginLogoOffsetX?: number;
  loginLogoOffsetY?: number;
  username: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  error: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onShowPasswordToggle: () => void;
  onRememberMeChange: (value: boolean) => void;
  onErrorDismiss: () => void;
  onSubmit: (e: FormEvent) => void;
}

export function LoginFormCard({
  companyName,
  companyLogoUrl,
  loginLogoScale = 100,
  loginLogoOffsetX = 0,
  loginLogoOffsetY = 0,
  username,
  password,
  showPassword,
  rememberMe,
  error,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onShowPasswordToggle,
  onRememberMeChange,
  onErrorDismiss,
  onSubmit,
}: LoginFormCardProps) {
  const subtitle = companyName
    ? `Sign in to access your ${companyName} workspace`
    : "Sign in to access your OpenSky HRM account";

  const logoSrc = resolveCompanyLogoSrc(companyLogoUrl);

  return (
    <div className="login-card relative z-10 rounded-2xl border bg-white" style={{ borderColor: LOGIN_THEME.border, boxShadow: LOGIN_THEME.cardShadow }}>
      <div className="login-card-logo-wrap flex justify-center">
        <div className="login-card-logo-holder" aria-hidden>
          <CompanyLogoDisplay
            src={logoSrc}
            alt=""
            fit="circle"
            scale={loginLogoScale}
            offsetX={loginLogoOffsetX}
            offsetY={loginLogoOffsetY}
            fallbackSrc={DEFAULT_LOGIN_LOGO}
          />
        </div>
      </div>

      <h2 className="login-card-title text-center font-bold tracking-tight" style={{ color: LOGIN_THEME.navy }}>
        Welcome Back!
      </h2>
      <p className="login-card-subtitle text-center" style={{ color: LOGIN_THEME.muted }}>
        {subtitle}
      </p>

      <form onSubmit={onSubmit} className="login-card-form">
        <FormErrorAlert
          message={error}
          onDismiss={onErrorDismiss}
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        />

        <div className="login-card-fields space-y-4">
          <div>
            <label htmlFor="username" className="login-field-label mb-1.5 block font-semibold" style={{ color: LOGIN_THEME.navy }}>
              Username
            </label>
            <div
              className="login-field-box flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:border-[#2E7BBF]"
              style={{ borderColor: LOGIN_THEME.border, backgroundColor: "#FAFBFC" }}
            >
              <span className="text-[#94A3B8]" aria-hidden>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="Enter your username"
                className="login-field-input w-full border-0 bg-transparent py-1 outline-none placeholder:text-[#94A3B8]"
                style={{ color: LOGIN_THEME.navy }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="login-field-label mb-1.5 block font-semibold" style={{ color: LOGIN_THEME.navy }}>
              Password
            </label>
            <div
              className="login-field-box flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:border-[#2E7BBF]"
              style={{ borderColor: LOGIN_THEME.border, backgroundColor: "#FAFBFC" }}
            >
              <span className="text-[#94A3B8]" aria-hidden>
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
                onChange={(e) => onPasswordChange(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="login-field-input w-full border-0 bg-transparent py-1 outline-none placeholder:text-[#94A3B8]"
                style={{ color: LOGIN_THEME.navy }}
              />
              <button
                type="button"
                onClick={onShowPasswordToggle}
                className="shrink-0 text-[#94A3B8] hover:text-[#64748B]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="login-card-actions mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: LOGIN_THEME.muted }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => onRememberMeChange(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2E7BBF] focus:ring-[#2E7BBF]"
            />
            Remember me
          </label>
          <Link
            href={ROUTES.forgotPassword}
            className="text-sm font-semibold hover:underline"
            style={{ color: LOGIN_THEME.skyBlue }}
          >
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="login-submit-btn mt-7 flex w-full items-center justify-center rounded-xl font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            backgroundColor: LOGIN_THEME.skyBlue,
            boxShadow: submitting || !username || !password ? "none" : "0 8px 24px rgba(46,123,191,0.35)",
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
            "Sign In"
          )}
        </button>
      </form>

      <p className="login-card-help text-center" style={{ color: LOGIN_THEME.muted }}>
        Need help?{" "}
        <Link href={ROUTES.contact} className="font-semibold hover:underline" style={{ color: LOGIN_THEME.skyBlue }}>
          Contact your administrator
        </Link>
      </p>
    </div>
  );
}
