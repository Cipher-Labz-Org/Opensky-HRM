import Link from "next/link";

export type NavItem = { href: string; label: string };
export type NavGroup = { title: string; items: NavItem[] };

type AppSidebarProps = {
  appName: string;
  navGroups: NavGroup[];
};

/**
 * App sidebar – reusable for dashboard, settings, billing.
 * Styling aligned with hris_ui_pack (dark sidebar, brand badge, nav groups).
 */
export function AppSidebar({ appName, navGroups }: AppSidebarProps) {
  return (
    <aside
      className="sticky top-0 h-screen overflow-y-auto px-[18px] py-6"
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
    </aside>
  );
}
