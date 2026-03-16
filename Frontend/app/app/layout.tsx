import React from "react";
import { APP_NAME } from "@/config/constants";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ROUTES } from "@/config/routes";

/**
 * Layout for all /app/* routes. Sidebar + main. No route group – literal "app" segment.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navGroups = [
    {
      title: "Core",
      items: [
        { href: ROUTES.dashboard, label: "Dashboard" },
        { href: ROUTES.people, label: "People Hub" },
        { href: ROUTES.employeeProfile, label: "Employee 360" },
        { href: ROUTES.recruitment, label: "Recruitment" },
        { href: ROUTES.onboarding, label: "Onboarding" },
      ],
    },
    {
      title: "Workforce",
      items: [
        { href: ROUTES.leave, label: "Leave & Absence" },
        { href: ROUTES.attendance, label: "Time & Attendance" },
        { href: ROUTES.payroll, label: "Payroll Bridge" },
        { href: ROUTES.performance, label: "Performance" },
        { href: ROUTES.learning, label: "Learning & Skills" },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { href: ROUTES.orgStructure, label: "Org Structure" },
        { href: ROUTES.analytics, label: "Analytics" },
        { href: ROUTES.settings, label: "Policy & Settings" },
        { href: ROUTES.billing, label: "Billing" },
      ],
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: "280px 1fr",
      }}
      className="app-shell-grid min-h-screen"
    >
      <AppSidebar appName={APP_NAME} navGroups={navGroups} />
      <main className="min-h-screen p-7" style={{ minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
