"use client";

import { usePathname } from "next/navigation";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ROUTES } from "@/config/routes";
import Link from "next/link";

const MARKETING_PATHS = ["/", "/pricing", "/contact"];
const APP_PATHS = [
  "/dashboard",
  "/people",
  "/employee-profile",
  "/recruitment",
  "/onboarding",
  "/offboarding",
  "/employee-tasks",
  "/leave",
  "/attendance",
  "/payroll",
  "/performance",
  "/learning",
  "/org-structure",
  "/org-chart",
  "/analytics",
  "/settings",
  "/billing",
];

function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href={ROUTES.home} className="text-xl font-bold text-[var(--text)]">
            {APP_NAME}
          </Link>
          <nav className="flex gap-6">
            <Link href={ROUTES.home} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Home
            </Link>
            <Link href={ROUTES.pricing} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href={ROUTES.contact} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Contact
            </Link>
            <Link href={ROUTES.dashboard} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow)]">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--border)] bg-[var(--panel)] py-6">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-[var(--muted)]">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const navGroups = [
    {
      title: "Core",
      items: [
        { href: ROUTES.dashboard, label: "Dashboard" },
        { href: ROUTES.people, label: "People Hub" },
        { href: ROUTES.employeeProfile, label: "Employee 360" },
        { href: ROUTES.recruitment, label: "Recruitment" },
        { href: ROUTES.onboarding, label: "Onboarding" },
        { href: ROUTES.offboarding, label: "Offboarding" },
      ],
    },
    {
      title: "Workforce",
      items: [
        { href: ROUTES.leave, label: "Leave & Absence" },
        { href: ROUTES.attendance, label: "Time & Attendance" },
        { href: ROUTES.payroll, label: "Payroll" },
        { href: ROUTES.performance, label: "Performance" },
        { href: ROUTES.learning, label: "Learning & Skills" },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: ROUTES.orgChart, label: "Org Chart" },
        { href: ROUTES.orgStructure, label: "Org Structure" },
        { href: ROUTES.analytics, label: "Analytics" },
        { href: ROUTES.settings, label: "Policy & Settings" },
        { href: ROUTES.billing, label: "Billing" },
      ],
    },
  ];
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
      <AppSidebar appName={APP_NAME} navGroups={navGroups} />
      <main className="p-7">{children}</main>
    </div>
  );
}

export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isMarketing = MARKETING_PATHS.includes(pathname);
  const isApp = APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isApp) return <AppShell>{children}</AppShell>;
  if (isMarketing) return <MarketingShell>{children}</MarketingShell>;
  return <>{children}</>;
}
