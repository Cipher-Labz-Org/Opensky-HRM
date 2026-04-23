"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";

export type NavItem = { href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

type AppSidebarProps = {
  appName: string;
  navGroups: NavGroup[];
  collapsed?: boolean;
  onToggle?: () => void;
};

const NAV_ICONS: Record<string, string> = {
  Dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
  "People Hub": "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  "Employee 360": "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z",
  Recruitment: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  "Employee Tasks": "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
  "Employee Actions": "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-2.695c.318-.344.679-.646 1.08-.895M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.286l1.755-2.126a1.125 1.125 0 011.598-.043L16.5 6.11m-5.08 9.06l5.653-4.655a2.548 2.548 0 013.286 0l2.126 1.755a1.125 1.125 0 01.043 1.598L18.89 16.5m-9.06-5.08L6.18 9.18a2.25 2.25 0 00-2.119 0L2.25 10.5M6 9l1.5-1.5M6 9l-1.5 1.5M6 9h3",
  "Leave & Absence": "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  "Time & Attendance": "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  "Payroll": "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  Performance: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  "Learning & Skills": "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5",
  Reports: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  "Org Chart": "M12 3v3m0 12v3M6 9h12M6 9a3 3 0 016 0m0 0a3 3 0 016 0M9 15h6M9 15a1.5 1.5 0 013 0m0 0a1.5 1.5 0 013 0",
  "Org Structure": "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  Analytics: "M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z",
  "Policy & Settings": "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "Email & letter templates": "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  "Email delivery log": "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  Billing: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  "Data Import / Export": "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5",
  "User Management": "M15.75 5.25a3 3 0 11-6 0 3 3 0 016 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
};

const SIDEBAR_EXPANDED_W = 280;
const SIDEBAR_COLLAPSED_W = 64;

export function AppSidebar({ appName, navGroups, collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const w = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;

  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ key: string; value: string }>("/api/system-settings/CompanyLogoUrl")
      .then((r) => { if (r.value) setCompanyLogoUrl(r.value); })
      .catch(() => {});
  }, []);

  return (
    <aside
      className="sticky top-0 z-30 flex h-screen flex-col overflow-hidden border-r border-slate-200/80 bg-white transition-all duration-300"
      style={{ width: `${w}px`, minWidth: `${w}px` }}
    >
      {/* Header — pr-11 reserves space so the collapse control stays inside the rail (avoids clip + overlap with main). */}
      <div
        className="relative flex items-center justify-center border-b border-slate-100 px-4 py-4 pr-11"
        style={{ height: collapsed ? "60px" : "60px" }}
      >
        {collapsed ? (
          companyLogoUrl ? (
            <img src={`${API_BASE_URL}${companyLogoUrl}`} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E8192C] to-[#2E7BBF] text-[10px] font-extrabold text-white">
              OS
            </div>
          )
        ) : (
          <>
            {companyLogoUrl ? (
              <img src={`${API_BASE_URL}${companyLogoUrl}`} alt="Company Logo" className="h-12 max-w-[240px] object-contain" />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E8192C] to-[#2E7BBF] text-xs font-extrabold text-white">
                  OS
                </div>
                <span className="text-base font-bold text-slate-700">{appName}</span>
              </div>
            )}
          </>
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-2 top-1/2 z-50 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-md ring-2 ring-white transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#2E7BBF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`min-h-0 flex-1 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-3"}`}>
        {navGroups.map((group) => (
          <div key={group.title} className="mb-2">
            {!collapsed && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-slate-100" />}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const iconPath = NAV_ICONS[item.label];
              const showLetterFallback = collapsed && !iconPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`sidebar-nav-link mb-0.5 flex items-center rounded-xl transition-all ${
                    collapsed
                      ? `justify-center px-0 py-2.5 ${isActive ? "bg-blue-50 text-[#2E7BBF]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`
                      : `gap-3 px-3 py-2.5 text-[13px] font-medium ${isActive ? "bg-blue-50 text-[#2E7BBF] border border-blue-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"}`
                  }`}
                >
                  {iconPath ? (
                    <svg className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-[18px] w-[18px]"} ${isActive ? "text-[#2E7BBF]" : "text-slate-400"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                    </svg>
                  ) : showLetterFallback ? (
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${isActive ? "bg-blue-100 text-[#2E7BBF]" : "bg-slate-100 text-slate-500"}`}>
                      {item.label.charAt(0).toUpperCase()}
                    </span>
                  ) : null}
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-50 px-5 py-2 text-center">
          <p className="text-[9px] text-slate-300">powered by <span className="font-semibold text-slate-400">OpenSky HRM</span></p>
        </div>
      )}
    </aside>
  );
}
