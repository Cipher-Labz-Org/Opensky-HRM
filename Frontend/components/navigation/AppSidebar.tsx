"use client";

import Link from "next/link";

export type NavItem = { href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

interface UserInfo {
  username: string;
  email: string;
  employeeName: string | null;
  profileImageUrl: string | null;
  roles: string[];
}

type AppSidebarProps = {
  appName: string;
  navGroups: NavGroup[];
  user?: UserInfo | null;
  onLogout?: () => void;
};

export function AppSidebar({ appName, navGroups, user, onLogout }: AppSidebarProps) {
  const displayName = user?.employeeName || user?.username || "User";
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside
      className="sticky top-0 flex h-screen flex-col overflow-y-auto px-[18px] py-6"
      style={{
        backgroundColor: "#0f172a",
        width: "280px",
        minWidth: "280px",
        color: "#ffffff",
      }}
    >
      <div className="mb-7 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] font-extrabold text-white">
          HR
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#ffffff" }}>
            {appName}
          </h1>
          <p className="mt-1 text-xs" style={{ color: "#cbd5e1" }}>
            Enterprise workforce platform
          </p>
        </div>
      </div>

      <div className="flex-1">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            <div
              className="mb-2.5 mt-3.5 px-2.5 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: "#94a3b8" }}
            >
              {group.title}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-nav-link mb-1 flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-sm transition hover:bg-white/10"
                style={{ color: "#f1f5f9" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {user && (
        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-400">
                {user.roles.map((r) => r.replace("_", " ")).join(", ")}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
