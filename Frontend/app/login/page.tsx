"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    window.location.replace("/app/dashboard");
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)" }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)" }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      window.location.replace("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-8"
      style={{
        background: "radial-gradient(circle at 0% 0%, rgba(239,51,79,0.08), transparent 28%), radial-gradient(circle at 100% 20%, rgba(60,130,214,0.10), transparent 30%), linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)",
      }}
    >
      {/* Shell */}
      <main
        className="grid w-full overflow-hidden rounded-[34px] border border-white/70 shadow-[0_30px_70px_rgba(15,23,42,0.12)]"
        style={{
          maxWidth: "1180px",
          minHeight: "700px",
          gridTemplateColumns: "1.08fr 0.92fr",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left — Brand Panel */}
        <div className="relative overflow-hidden border-r border-black/5 p-14" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(246,249,253,0.94))" }}>
          {/* Decorative circles */}
          <div className="absolute -right-[180px] -top-[180px] h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(circle, rgba(60,130,214,0.16), transparent 65%)" }} />
          <div className="absolute -bottom-[120px] -left-[120px] h-[380px] w-[380px] rounded-full" style={{ background: "radial-gradient(circle, rgba(239,51,79,0.12), transparent 68%)" }} />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              {/* Logo */}
              <div className="mb-6 inline-flex rounded-2xl bg-white p-4 shadow-sm">
                <img src="/opensky-logo.png" alt="OpenSky" className="h-12 w-auto object-contain" />
              </div>

              {/* Eyebrow */}
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/10 bg-blue-500/[0.08] px-3 py-2 text-[12px] font-bold uppercase tracking-widest text-[#245aa5]">
                Human Resource Management
              </span>

              {/* Title */}
              <h1 className="mb-4 max-w-[520px] text-[44px] font-[750] leading-[1.08] tracking-tight">
                Modern HR operations for a{" "}
                <span className="text-[#3c82d6]">connected</span> and{" "}
                <span className="text-[#ef334f]">empowered</span> workforce
              </h1>

              {/* Lead */}
              <p className="mb-8 max-w-[520px] text-base leading-relaxed text-[#667085]">
                Streamline every stage of the employee lifecycle — from recruitment and onboarding to payroll, attendance, and performance — in one unified platform.
              </p>

              {/* Feature Grid */}
              <div className="grid max-w-[560px] grid-cols-2 gap-4">
                {[
                  { icon: "👥", title: "Employee Central", desc: "Manage profiles, documents, departments, job roles, and workforce records in one place." },
                  { icon: "🕒", title: "Attendance & Leave", desc: "Track attendance, shifts, time-off requests, and approvals with clarity." },
                  { icon: "💼", title: "HR Workflows", desc: "Standardize onboarding, confirmations, transfers, and internal HR processes." },
                  { icon: "📊", title: "People Insights", desc: "Access dashboards and workforce summaries for informed management decisions." },
                ].map((f) => (
                  <article key={f.title} className="rounded-[20px] border border-black/[0.06] bg-white/[0.78] p-[18px] shadow-[0_14px_28px_rgba(15,23,42,0.05)]">
                    <div className="mb-3 grid h-[42px] w-[42px] place-items-center rounded-[14px] text-lg" style={{ background: "linear-gradient(135deg, rgba(60,130,214,0.12), rgba(239,51,79,0.12))" }}>
                      {f.icon}
                    </div>
                    <h3 className="mb-1.5 text-[15px] font-bold text-slate-900">{f.title}</h3>
                    <p className="text-[13px] leading-relaxed text-[#667085]">{f.desc}</p>
                  </article>
                ))}
              </div>
            </div>

            {/* Bottom note */}
            <div className="mt-8 flex items-center justify-between gap-4 border-t border-black/[0.07] pt-6 text-[13px] text-[#7a8699]">
              <span>Professional enterprise UI for HR teams</span>
              <span className="text-[11px]">powered by <strong className="text-slate-600">OpenSky HRM</strong></span>
            </div>
          </div>
        </div>

        {/* Right — Auth Panel */}
        <div className="flex items-center justify-center p-10" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(252,253,255,0.98) 100%)" }}>
          <div className="w-full max-w-[430px] rounded-[28px] border border-black/[0.06] bg-white p-[34px] shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            {/* Badge */}
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-600">
              🔒 Secure Sign In
            </span>

            <h2 className="mb-2 text-[30px] font-bold leading-tight tracking-tight text-slate-900">Welcome back</h2>
            <p className="mb-7 text-[14px] leading-relaxed text-[#667085]">Sign in to continue to your HR workspace.</p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Username */}
              <div className="mb-4">
                <label htmlFor="email" className="mb-2 block text-[13px] font-bold text-[#344054]">
                  Work Email or Username
                </label>
                <input
                  id="email"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your work email or username"
                  className="h-[52px] w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-[#98a2b3] focus:border-blue-400/60 focus:bg-white focus:shadow-[0_0_0_4px_rgba(60,130,214,0.10)]"
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label htmlFor="password" className="mb-2 block text-[13px] font-bold text-[#344054]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-[52px] w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 pr-16 text-[14px] text-slate-900 outline-none transition placeholder:text-[#98a2b3] focus:border-blue-400/60 focus:bg-white focus:shadow-[0_0_0_4px_rgba(60,130,214,0.10)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[10px] px-2 py-1.5 text-[13px] font-bold text-[#667085] transition hover:bg-blue-50 hover:text-[#245aa5]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Remember / Forgot */}
              <div className="mb-5 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 text-[13px] font-semibold text-[#475467]">
                  <input type="checkbox" className="h-4 w-4 rounded accent-[#3c82d6]" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-[13px] font-bold text-[#245aa5] hover:underline">
                  Forgot password?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !username || !password}
                className="h-[54px] w-full rounded-[16px] text-[15px] font-extrabold tracking-wide text-white shadow-[0_14px_28px_rgba(60,130,214,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(60,130,214,0.24)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{ background: "linear-gradient(90deg, #ef334f, #3c82d6)" }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Secure note */}
            <div className="mt-5 text-center text-[12px] leading-relaxed text-[#667085]">
              <strong className="text-[#344054]">Protected access</strong><br />
              256-bit TLS encryption · SOC 2 compliant
            </div>
          </div>
        </div>
      </main>

      {/* Responsive: stack on mobile */}
      <style jsx>{`
        @media (max-width: 980px) {
          main { grid-template-columns: 1fr !important; min-height: auto !important; }
        }
      `}</style>
    </div>
  );
}
