"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { LicensePageGate } from "@/components/licensing/LicensePageGate";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";

interface NavItem {
  href: string;
  label: string;
  module?: string;
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
      { href: ROUTES.employeeTasks, label: "Employee Tasks", module: "EmployeeTasks" },
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
      { href: ROUTES.emailTemplates, label: "Email templates", module: "Settings" },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout, hasPermission, isAdmin } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  const licensedModules = user?.licensedModules;

  const filteredNavGroups = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!isLicensedForNav(item.module, licensedModules)) return false;
        if (isAdmin) return true;
        if (!item.module) return true;
        return hasPermission(item.module, "Read");
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="app-shell-grid flex min-h-screen">
      <AppSidebar
        appName={APP_NAME}
        navGroups={filteredNavGroups}
        user={user}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="min-h-screen flex-1 p-7" style={{ minWidth: 0 }}>
        <LicensePageGate>{children}</LicensePageGate>
      </main>
    </div>
  );
}
