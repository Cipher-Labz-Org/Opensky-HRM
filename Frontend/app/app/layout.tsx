"use client";

import React, { useState, useEffect } from "react";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppGlobalHeader } from "@/components/navigation/AppGlobalHeader";
import { PeopleHubHelpProvider } from "@/components/help/PeopleHubHelpPanel";
import { LicensePageGate } from "@/components/licensing/LicensePageGate";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";

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
      { href: ROUTES.peopleAuditTrail, label: "People audit trail", module: "People" },
      { href: ROUTES.employeeProfile, label: "Employee 360", module: "People" },
      { href: ROUTES.recruitment, label: "Recruitment", module: "Recruitment" },
      {
        href: ROUTES.employeeTasks,
        label: "Employee Tasks",
        moduleAnyOf: ["People", "Recruitment", "EmployeeTasks"],
      },
      { href: ROUTES.employeeActions, label: "Employee Actions", module: "People" },
    ],
  },
  {
    title: "Workforce",
    items: [
      { href: ROUTES.leave, label: "Leave & Absence", module: "Leave" },
      { href: ROUTES.attendance, label: "Time & Attendance", module: "Attendance" },
      { href: ROUTES.payroll, label: "Payroll", module: "Payroll" },
      { href: ROUTES.performance, label: "Performance", module: "Performance" },
      { href: ROUTES.learning, label: "Learning & Skills", module: "Learning" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: ROUTES.reports, label: "Reports", module: "Analytics" },
      { href: ROUTES.orgStructure, label: "Org Structure", module: "OrgStructure" },
      { href: ROUTES.analytics, label: "Analytics", module: "Analytics" },
      { href: ROUTES.settings, label: "Policy & Settings", module: "Settings" },
      { href: ROUTES.billing, label: "Billing" },
    ],
  },
  {
    title: "Audit & Compliance",
    items: [
      { href: ROUTES.emailTemplates, label: "Email & letter templates", module: "Settings" },
      { href: ROUTES.emailDeliveryLog, label: "Email delivery log", module: "Settings" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: ROUTES.administration, label: "Data Import / Export", module: "Administration" },
      { href: ROUTES.userManagement, label: "User Management", module: "Administration" },
    ],
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

function navItemReadAllowed(
  item: NavItem,
  isAdmin: boolean,
  hasPermission: (module: string, action: string) => boolean
): boolean {
  if (isAdmin) return true;
  if (item.moduleAnyOf?.length) return item.moduleAnyOf.some((m) => hasPermission(m, "Read"));
  if (!item.module) return true;
  return hasPermission(item.module, "Read");
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout, hasPermission, isAdmin } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;
    // Intentionally omit `usePathname` from deps — pathname changes on every client navigation and
    // would re-run this effect, causing repeated `location.replace` loops while auth state settles.
    const path = typeof window !== "undefined" ? window.location.pathname : "/";
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

  const licensedModules = user?.licensedModules;

  const filteredNavGroups = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!isNavItemLicensed(item, licensedModules)) return false;
        return navItemReadAllowed(item, isAdmin, hasPermission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <PeopleHubHelpProvider>
      <div className="app-shell-grid flex min-h-screen">
        <AppSidebar
          appName={APP_NAME}
          navGroups={filteredNavGroups}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[var(--bg)] pl-3 sm:pl-5">
          {user ? <AppGlobalHeader user={user} onLogout={logout} /> : null}
          <main className="flex-1 p-7" style={{ minWidth: 0 }}>
            <LicensePageGate>{children}</LicensePageGate>
          </main>
        </div>
      </div>
    </PeopleHubHelpProvider>
  );
}
