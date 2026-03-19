"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
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
      { href: ROUTES.employeeProfile, label: "Employee 360", module: "People" },
      { href: ROUTES.recruitment, label: "Recruitment" },
      { href: ROUTES.onboarding, label: "Onboarding" },
    ],
  },
  {
    title: "Workforce",
    items: [
      { href: ROUTES.leave, label: "Leave & Absence", module: "Leave" },
      { href: ROUTES.attendance, label: "Time & Attendance", module: "Attendance" },
      { href: ROUTES.payroll, label: "Payroll Bridge", module: "Payroll" },
      { href: ROUTES.performance, label: "Performance", module: "Performance" },
      { href: ROUTES.learning, label: "Learning & Skills", module: "Learning" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: ROUTES.orgStructure, label: "Org Structure", module: "OrgStructure" },
      { href: ROUTES.analytics, label: "Analytics", module: "Analytics" },
      { href: ROUTES.settings, label: "Policy & Settings", module: "Settings" },
      { href: ROUTES.billing, label: "Billing" },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout, hasPermission, isAdmin } = useAuth();
  const router = useRouter();

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

  const filteredNavGroups = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isAdmin) return true;
        if (!item.module) return true;
        return hasPermission(item.module, "Read");
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      style={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: "280px 1fr",
      }}
      className="app-shell-grid min-h-screen"
    >
      <AppSidebar appName={APP_NAME} navGroups={filteredNavGroups} user={user} onLogout={logout} />
      <main className="min-h-screen p-7" style={{ minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
