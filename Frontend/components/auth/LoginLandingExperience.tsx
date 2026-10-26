"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../contexts/auth-context";
import { ROUTES } from "../../config/routes";
import { safeAppRedirect } from "@/lib/safe-app-redirect";
import { fetchCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { LOGIN_THEME } from "@/lib/opensky-theme";
import { LoginWaveBackground } from "@/components/auth/LoginWaveBackground";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import { LoginFormCard } from "@/components/auth/LoginFormCard";

type Branding = CompanyBranding;

const ERP_LOGIN_URL =
  process.env.NEXT_PUBLIC_ERP_LOGIN_URL?.trim() || "http://localhost:5173/login";

function isOpenedFromErpShell(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") ?? "";
  return (
    params.get("embed") === "1" ||
    redirect.includes("embed=1") ||
    sessionStorage.getItem("opensky-erp-embed") === "1" ||
    window.self !== window.top
  );
}

function erpOnlyAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ERP_ONLY_AUTH !== "1") return false;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function resolvePostLoginPath(mustChangePassword: boolean): string {
  if (mustChangePassword) return ROUTES.changePassword;
  if (typeof window === "undefined") return ROUTES.dashboard;
  return safeAppRedirect(new URLSearchParams(window.location.search).get("redirect"));
}

/**
 * OpenSky-branded sign-in — split layout matching brand mockup.
 */
export function LoginLandingExperience() {
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [branding, setBranding] = useState<Branding>({
    companyName: "",
    companyLogoUrl: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isOpenedFromErpShell()) return;
    if (!erpOnlyAuthEnabled()) return;
    window.location.replace(ERP_LOGIN_URL);
  }, [mounted]);

  useEffect(() => {
    let isMounted = true;
    fetchCompanyBranding()
      .then((data) => {
        if (!isMounted) return;
        setBranding(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;
    window.location.replace(resolvePostLoginPath(user.mustChangePassword === true));
  }, [isAuthenticated, isLoading, user]);

  if (!mounted || isLoading || isAuthenticated || (erpOnlyAuthEnabled() && !isOpenedFromErpShell())) {
    return (
      <div
        className="flex min-h-screen min-h-[100dvh] items-center justify-center"
        style={{ backgroundColor: LOGIN_THEME.background }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: LOGIN_THEME.border, borderTopColor: LOGIN_THEME.skyBlue }}
        />
      </div>
    );
  }

  if (isOpenedFromErpShell()) {
    return (
      <div
        className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ backgroundColor: LOGIN_THEME.background }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: LOGIN_THEME.border, borderTopColor: LOGIN_THEME.skyBlue }}
        />
        <p className="max-w-md text-sm text-slate-600">
          HRM uses your OpenSky ERP sign-in. Open HR from the ERP menu after you sign in there — this
          screen does not accept a separate HRM password.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await login(username, password, rememberMe);
      window.location.replace(resolvePostLoginPath(profile.mustChangePassword === true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="login-page relative isolate"
      style={{ backgroundColor: LOGIN_THEME.background }}
    >
      <LoginWaveBackground />

      <div className="login-shell">
        <div className="login-shell-brand">
          <LoginBrandPanel />
        </div>

        <div className="login-shell-form">
          <LoginFormCard
            companyName={branding.companyName || undefined}
            companyLogoUrl={branding.companyLogoUrl}
            loginLogoScale={branding.loginLogoScale}
            loginLogoOffsetX={branding.loginLogoOffsetX}
            loginLogoOffsetY={branding.loginLogoOffsetY}
            username={username}
            password={password}
            showPassword={showPassword}
            rememberMe={rememberMe}
            error={error}
            submitting={submitting}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onShowPasswordToggle={() => setShowPassword((v) => !v)}
            onRememberMeChange={setRememberMe}
            onErrorDismiss={() => setError("")}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
