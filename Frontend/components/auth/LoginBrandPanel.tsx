import Image from "next/image";
import { LOGIN_THEME } from "@/lib/opensky-theme";

const FEATURES = [
  {
    label: "People Management",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  {
    label: "Attendance Tracking",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3h3.75m-3.75 0h3.75m-3.75 0v3.75m0-3.75v-3.75"
        />
      </svg>
    ),
  },
  {
    label: "Payroll Processing",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    label: "Insights & Reports",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
] as const;

export function LoginBrandPanel() {
  return (
    <div className="login-brand-panel relative z-10 flex h-full min-w-0 flex-col">
      <div className="login-brand-content flex flex-1 flex-col justify-center">
        <div className="login-logo-slot">
          <Image
            src="/opensky-hrm-brand-logo.png?v=3"
            alt="OpenSky HRM"
            width={740}
            height={100}
            unoptimized
            className="login-logo-image object-contain object-left"
            priority
          />
        </div>

        <h1 className="login-brand-title max-w-xl font-bold leading-tight tracking-tight" style={{ color: LOGIN_THEME.navy }}>
          Empowering{" "}
          <span style={{ color: LOGIN_THEME.skyBlue }}>People.</span>
          <br />
          Elevating{" "}
          <span style={{ color: LOGIN_THEME.green }}>Performance.</span>
        </h1>

        <p className="login-brand-copy mt-4 max-w-lg leading-relaxed" style={{ color: LOGIN_THEME.muted }}>
          OpenSky HRM is your all-in-one platform to manage workforce, streamline HR operations and drive
          organizational success.
        </p>

        <div className="login-features mt-6 pb-2">
          {FEATURES.map((feature) => (
            <div key={feature.label} className="login-feature-item flex flex-col items-center text-center">
              <div
                className="login-feature-icon flex items-center justify-center rounded-full"
                style={{ color: LOGIN_THEME.skyBlue }}
              >
                {feature.icon}
              </div>
              <span
                className="login-feature-label mt-2 font-medium leading-tight"
                style={{ color: LOGIN_THEME.muted }}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="login-copyright mt-auto hidden pt-6 text-xs sm:block">
        © 2026 OpenSky HRM. All rights reserved.
      </p>
    </div>
  );
}
