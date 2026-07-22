"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../contexts/auth-context";
import { ROUTES } from "../../config/routes";
import { fetchCompanyBranding, type CompanyBranding } from "@/lib/company-branding";
import { LOGIN_THEME } from "@/lib/opensky-theme";
import { LoginWaveBackground } from "@/components/auth/LoginWaveBackground";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import { LoginFormCard } from "@/components/auth/LoginFormCard";

type Branding = CompanyBranding;

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
    window.location.replace(user.mustChangePassword === true ? ROUTES.changePassword : "/app/dashboard");
  }, [isAuthenticated, isLoading, user]);

  if (!mounted || isAuthenticated) {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await login(username, password, rememberMe);
      window.location.replace(profile.mustChangePassword === true ? ROUTES.changePassword : "/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="login-page relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden"
      style={{ backgroundColor: LOGIN_THEME.background }}
    >
      <LoginWaveBackground />

      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-[1320px] flex-col lg:flex-row">
        <div className="flex flex-1 flex-col lg:min-h-screen lg:basis-[55%]">
          <LoginBrandPanel />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:basis-[45%] lg:px-12 lg:py-12">
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
