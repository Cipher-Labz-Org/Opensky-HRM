"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppGlobalHeader } from "@/components/navigation/AppGlobalHeader";
import { AppDialogsProvider } from "@/components/ui/AppDialogsProvider";
import { AiSidekickFab, AiSidekickPanel, AiSidekickProvider } from "@/components/ai-sidekick";
import { LicensePageGate } from "@/components/licensing/LicensePageGate";
import { PagePermissionGate } from "@/components/licensing/PagePermissionGate";
import { ROUTES } from "@/config/routes";
import { isAlwaysVisibleNavHref, isNavItemVisible } from "@/lib/nav-visibility";
import { useAuth } from "@/contexts/auth-context";
import { syncErpEmbedChrome } from "@/components/theme/ErpEmbedTheme";
import { PageHelpLink } from "@/components/help/PageHelpLink";

interface NavItem {
  href: string;
  label: string;
  /** Single licensed module (sidebar + permission check). */
  module?: string;
  /** Show if any of these modules is licensed (e.g. Employee Tasks = People | Recruitment | EmployeeTasks). */
  moduleAnyOf?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    title: "Core",
    items: [
      { href: ROUTES.dashboard, label: "Dashboard", module: "Dashboard" },
      { href: ROUTES.people, label: "People Hub", module: "People" },
      { href: ROUTES.employeeProfile, label: "Employee bio", module: "EmployeeBio" },
      { href: ROUTES.recruitment, label: "Recruitment", module: "Recruitment" },
      { href: ROUTES.employeeTasks, label: "Employee Tasks", module: "EmployeeTasks" },
      { href: ROUTES.employeeActions, label: "Employee Actions", module: "EmployeeActions" },
    ],
  },
  {
    title: "Workforce",
    items: [
      { href: ROUTES.leave, label: "Leave & Absence", module: "Leave" },
      { href: ROUTES.approvals, label: "Approvals", module: "Approvals" },
      { href: ROUTES.attendance, label: "Time & Attendance", module: "Attendance" },
      { href: ROUTES.payroll, label: "Payroll", module: "Payroll" },
      { href: ROUTES.performance, label: "Performance Appraisal", module: "Performance" },
      { href: ROUTES.learning, label: "Learning & Skills", module: "Learning" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: ROUTES.reports, label: "Reports", module: "Reports" },
      { href: ROUTES.orgStructure, label: "Org Structure", module: "OrgStructure" },
      { href: ROUTES.analytics, label: "Analytics", module: "Analytics" },
      { href: ROUTES.companyProfile, label: "Company Profile", module: "CompanyProfile" },
      { href: ROUTES.settings, label: "Policy & Settings", module: "Settings" },
      { href: ROUTES.billing, label: "Billing", module: "Billing" },
    ],
  },
  {
    title: "Audit & Compliance",
    items: [
      { href: ROUTES.emailTemplates, label: "Email & letter templates", module: "EmailTemplates" },
      { href: ROUTES.emailDeliveryLog, label: "Email delivery log", module: "EmailDeliveryLog" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: ROUTES.administration, label: "Data Import / Export", module: "Administration" },
      { href: ROUTES.userManagement, label: "User Management", module: "UserManagement" },
    ],
  },
  {
    title: "Help",
    items: [{ href: ROUTES.helpGuides, label: "Help & guides" }],
  },
];

function isLicensedForNav(
  module: string | undefined,
  licensedModules: string[] | undefined
): boolean {
  if (!module) return true;
  if (licensedModules == null || licensedModules.length === 0) return true;
  return licensedModules.includes(module);
}

function isNavItemLicensed(item: NavItem, licensedModules: string[] | undefined): boolean {
  if (item.moduleAnyOf?.length) {
    if (licensedModules == null || licensedModules.length === 0) return true;
    return item.moduleAnyOf.some((m) => licensedModules.includes(m));
  }
  return isLicensedForNav(item.module, licensedModules);
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    user,
    isAuthenticated,
    isLoading,
    logout,
    hasPermission,
    isAdmin,
    getPeopleReadScope,
    getLeaveReadScope,
    hasRole,
  } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    setEmbed(syncErpEmbedChrome());
  }, [pathname]);

  useEffect(() => {
    if (isLoading || !user) return;
    if (user.mustChangePassword && pathname !== ROUTES.changePassword) {
      window.location.replace(ROUTES.changePassword);
    }
  }, [isLoading, user, pathname]);

  useEffect(() => {
    if (isLoading || !user) return;
    if (!user.mustChangePassword && pathname === ROUTES.changePassword) {
      window.location.replace(ROUTES.dashboard);
    }
  }, [isLoading, user, pathname]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;
    // Opened from the ERP shell: the ERP login is the only sign-in page. Wait for that session.
    if (typeof window !== "undefined" && syncErpEmbedChrome()) return;
    // Intentionally omit `usePathname` from deps — pathname changes on every client navigation and
    // would re-run this effect, causing repeated `location.replace` loops while auth state settles.
    const path = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";
    const next = `/login${path && path !== "/" ? `?redirect=${encodeURIComponent(path)}` : ""}`;
    // Hard navigation avoids a stuck spinner when client-side routing does not complete.
    window.location.replace(next);
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return <FullScreenSpinner />;
  }

  if (!isAuthenticated) {
    return <FullScreenSpinner />;
  }

  if (!user) {
    return <FullScreenSpinner />;
  }

  if (user.mustChangePassword) {
    if (pathname === ROUTES.changePassword) {
      return (
        <AppDialogsProvider>
          <div className="flex min-h-screen flex-col bg-[var(--bg)]">
            <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8">{children}</main>
          </div>
        </AppDialogsProvider>
      );
    }
    return <FullScreenSpinner />;
  }

  if (pathname === ROUTES.changePassword) {
    return <FullScreenSpinner />;
  }

  const licensedModules = user.licensedModules;

  const navVisibilityCtx = {
    isAdmin,
    hasPermission,
    getPeopleReadScope,
    getLeaveReadScope,
    hasRole,
    permissions: user.permissions,
  };

  const filteredNavGroups = ALL_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!isAlwaysVisibleNavHref(item.href) && !isNavItemLicensed(item, licensedModules)) return false;
      return isNavItemVisible(item.href, navVisibilityCtx);
    }),
  })).filter((group) => group.items.length > 0);

  const gatedChildren = (
    <LicensePageGate>
      <PagePermissionGate ctx={navVisibilityCtx} fallbackHref={filteredNavGroups[0]?.items[0]?.href ?? null}>
        {children}
      </PagePermissionGate>
    </LicensePageGate>
  );

  if (embed) {
    return (
      <AppDialogsProvider>
        <main className="min-h-screen bg-[var(--bg)] px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
          <PageHelpLink floating />
          {gatedChildren}
        </main>
      </AppDialogsProvider>
    );
  }

  return (
    <AppDialogsProvider>
      <AiSidekickProvider>
        <div className="app-shell-grid flex min-h-screen">
          <AppSidebar
            appName={APP_NAME}
            navGroups={filteredNavGroups}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <div className="app-shell-main-column flex min-h-screen min-w-0 flex-1 flex-col">
            <AppGlobalHeader user={user} onLogout={logout} />
            <main className="app-shell-canvas flex-1 p-6 sm:p-7" style={{ minWidth: 0 }}>
              <PageHelpLink />
              {gatedChildren}
            </main>
            <footer className="app-shell-footer border-t px-6 py-3 text-center sm:px-7">
              <p className="text-xs tracking-wide" style={{ color: "var(--muted)" }}>
                © {new Date().getFullYear()} OpenSky HRM · Enabling Growth
              </p>
            </footer>
          </div>
          <AiSidekickPanel />
          <AiSidekickFab />
        </div>
      </AiSidekickProvider>
    </AppDialogsProvider>
  );
}
