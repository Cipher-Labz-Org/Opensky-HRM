"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { resolveAuthApiPath } from "../../config/constants";
import { ROUTES } from "../../config/routes";

type Step = "verify" | "reset" | "done";

export function ForgotPasswordExperience() {
  const [step, setStep] = useState<Step>("verify");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(resolveAuthApiPath("/api/auth/forgot-password/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ employeeCode: employeeCode.trim(), email: email.trim() }),
      });
      const data = (await res.json()) as { resetToken?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Employee number and email do not match our records.");
      }
      if (!data.resetToken) {
        throw new Error("Verification failed. Please try again.");
      }
      setResetToken(data.resetToken);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(resolveAuthApiPath("/api/auth/forgot-password/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Could not reset password.");
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#e8f2fa]">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 80% at 20% 20%, rgba(91,164,229,0.35), transparent 50%), radial-gradient(90% 70% at 85% 75%, rgba(58,134,202,0.28), transparent 52%), linear-gradient(165deg, #e8f2fa 0%, #dceaf6 45%, #cfe2f5 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-8">
        <main className="w-full max-w-md overflow-hidden rounded-[25px] border border-white/40 bg-white/70 px-8 py-10 shadow-[0_24px_64px_rgba(15,23,42,0.28)] backdrop-blur-[10px] sm:px-11 sm:py-12">
          <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
            {step === "done" ? "Password updated" : "Forgot password"}
          </h1>
          <div className="mx-auto mt-3 h-[3px] w-12 rounded-full bg-[#1a92d5]" aria-hidden />

          {step === "verify" && (
            <>
              <p className="mt-4 text-center text-sm text-slate-600">
                Enter your employee number and email. If they match our records, you can set a new password.
              </p>
              <form onSubmit={handleVerify} className="mt-9">
                {error && <ErrorBanner message={error} />}

                <Field
                  icon="badge"
                  id="employeeCode"
                  type="text"
                  value={employeeCode}
                  onChange={setEmployeeCode}
                  placeholder="Employee number (e.g. EMP-000001)"
                  autoComplete="off"
                  autoFocus
                  required
                />

                <div className="mb-7">
                  <Field
                    icon="email"
                    id="email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="Your email address"
                    autoComplete="email"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !employeeCode.trim() || !email.trim()}
                  className="h-[50px] w-full rounded-full bg-[#3a86ca] text-[15px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(58,134,202,0.38)] transition hover:bg-[#2f75b5] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {submitting ? "Verifying…" : "Verify identity"}
                </button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <p className="mt-4 text-center text-sm text-slate-600">
                Identity verified. Choose a new password for your account.
              </p>
              <form onSubmit={handleReset} className="mt-9">
                {error && <ErrorBanner message={error} />}

                <Field
                  icon="lock"
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={6}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#2E7BBF] hover:text-[#1a92d5]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  }
                />

                <div className="mb-7">
                  <Field
                    icon="lock"
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !newPassword || !confirmPassword}
                  className="h-[50px] w-full rounded-full bg-[#3a86ca] text-[15px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(58,134,202,0.38)] transition hover:bg-[#2f75b5] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {submitting ? "Saving…" : "Change password"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="mt-9 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-600">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Link
                href={ROUTES.login}
                className="mt-8 inline-flex h-[50px] w-full items-center justify-center rounded-full bg-[#3a86ca] text-[15px] font-bold tracking-wide text-white shadow-[0_8px_24px_rgba(58,134,202,0.38)] transition hover:bg-[#2f75b5]"
              >
                Back to sign in
              </Link>
            </div>
          )}

          {step !== "done" && (
            <p className="mt-8 text-center text-sm text-slate-600">
              Remember your password?{" "}
              <Link href={ROUTES.login} className="font-semibold text-[#1a92d5] hover:text-[#157fc0] hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      {message}
    </div>
  );
}

function Field({
  icon,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  required,
  minLength,
  trailing,
}: {
  icon: "badge" | "email" | "lock";
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-3 border-b border-[#add8e6] pb-2.5 transition-colors focus-within:border-[#1a92d5]">
        <span className="text-[#1a92d5]" aria-hidden>
          {icon === "email" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          ) : icon === "lock" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
              />
            </svg>
          )}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          className="w-full border-0 bg-transparent py-2 text-[15px] text-slate-900 outline-none placeholder:text-[#8eb8d9]"
        />
        {trailing}
      </div>
    </div>
  );
}
