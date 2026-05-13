"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";

export type BirthdaysCompanyNoticesWidgetProps = {
  /** Base URL for in-widget “View all” links; must include `#birthdays-notices` when used on that anchor. */
  scrollAnchorHref?: string;
};

type BirthdayPerson = {
  employeeId: string;
  fullName: string;
  departmentName: string | null;
  profileImageUrl: string | null;
  occasionDate: string;
  isToday: boolean;
  daysUntil: number;
};

type BirthdaySummary = {
  today: BirthdayPerson[];
  upcoming: BirthdayPerson[];
};

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt: string | null;
};

type InboxResponse = {
  items: NoticeItem[];
  unreadCount: number;
};

const digestCategories = new Set(["BirthdayToday", "BirthdayUpcoming", "EmployeeBirthdayDigest"]);

type NoticeKind = "important" | "event" | "reminder" | "wish" | "notice";

function formatMd(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function formatNoticeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function classifyNotice(category: string): NoticeKind {
  const c = category.toLowerCase();
  if (c === "birthdaywish") return "wish";
  if (c.includes("probation") || c.includes("retire") || c.includes("terminat") || c.includes("critical"))
    return "important";
  if (c.includes("leave") || c.includes("interview") || c.includes("gathering") || c.includes("event"))
    return "event";
  if (c.includes("license") || c.includes("expir") || c.includes("remind") || c.includes("update"))
    return "reminder";
  return "notice";
}

function noticeLabel(kind: NoticeKind): string {
  switch (kind) {
    case "important":
      return "Important";
    case "event":
      return "Event";
    case "reminder":
      return "Reminder";
    case "wish":
      return "Wish";
    default:
      return "Notice";
  }
}

function NoticeIcon({ kind }: { kind: NoticeKind }) {
  if (kind === "important") {
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500 text-xs font-extrabold text-white shadow-sm"
        aria-hidden
      >
        !
      </span>
    );
  }
  if (kind === "event") {
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-base leading-none text-white shadow-sm"
        aria-hidden
      >
        📅
      </span>
    );
  }
  if (kind === "reminder") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-sm text-white shadow-sm" aria-hidden>
        🔔
      </span>
    );
  }
  if (kind === "wish") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-base" aria-hidden>
        🎉
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sm text-sky-700" aria-hidden>
      📣
    </span>
  );
}

function pillClass(kind: NoticeKind): string {
  switch (kind) {
    case "important":
      return "bg-red-50 text-red-700 ring-1 ring-red-200/80";
    case "event":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80";
    case "reminder":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80";
    case "wish":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
    default:
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
  }
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Split `/path?query#anchor` — pathname excludes query string (for same-route checks). */
function hubHrefParts(href: string): { pathname: string; hashId: string | null } {
  const hashI = href.indexOf("#");
  const beforeHash = hashI >= 0 ? href.slice(0, hashI) : href;
  const rawHash = hashI >= 0 ? href.slice(hashI + 1).replace(/^#/, "") : "";
  const hashId = rawHash.length > 0 ? rawHash : null;
  const qI = beforeHash.indexOf("?");
  const pathname = qI >= 0 ? beforeHash.slice(0, qI) : beforeHash;
  return { pathname, hashId };
}

function BirthdaysHubLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { pathname, hashId } = hubHrefParts(href);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!hashId || typeof window === "undefined") return;
      if (window.location.pathname !== pathname) return;
      e.preventDefault();
      const tail = href.startsWith(pathname) ? href.slice(pathname.length) : "";
      router.replace(`${pathname}${tail}`, { scroll: false });
      window.setTimeout(() => {
        document.getElementById(hashId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    },
    [hashId, href, pathname, router],
  );

  return (
    <Link href={href} scroll={false} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}

function BirthdaysCompanyNoticesWidgetInner({ scrollAnchorHref }: BirthdaysCompanyNoticesWidgetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wishFocusParam = searchParams.get("birthdayWish")?.trim() ?? "";

  const [summary, setSummary] = React.useState<BirthdaySummary | null>(null);
  const [notices, setNotices] = React.useState<NoticeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [wishBusyId, setWishBusyId] = React.useState<string | null>(null);
  const [wishHint, setWishHint] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [wishHighlightId, setWishHighlightId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [bd, inbox] = await Promise.all([
        apiFetch<BirthdaySummary>("/api/employees/birthdays/summary"),
        apiFetch<InboxResponse>("/api/notifications?take=40"),
      ]);
      setSummary({
        today: Array.isArray(bd.today) ? bd.today : [],
        upcoming: Array.isArray(bd.upcoming) ? bd.upcoming : [],
      });
      const items = Array.isArray(inbox.items) ? inbox.items : [];
      setNotices(items.filter((n) => !digestCategories.has(n.category)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load birthdays or notices.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  React.useEffect(() => {
    if (loading || !wishFocusParam) return;
    const clearWishParam = () => {
      if (typeof window === "undefined") return;
      const u = new URL(window.location.href);
      if (!u.searchParams.has("birthdayWish")) return;
      u.searchParams.delete("birthdayWish");
      const next = u.pathname + (u.search ? u.search : "") + u.hash;
      router.replace(next, { scroll: false });
    };
    const t = window.setTimeout(() => {
      const el = document.getElementById(`birthday-wish-target-${wishFocusParam}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setWishHighlightId(wishFocusParam);
        window.setTimeout(() => {
          setWishHighlightId(null);
          clearWishParam();
        }, 2600);
      } else {
        clearWishParam();
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [loading, wishFocusParam, router, summary]);

  const today = summary?.today ?? [];
  const upcoming = summary?.upcoming ?? [];

  async function sendWish(employeeId: string) {
    setWishHint(null);
    setWishBusyId(employeeId);
    try {
      const res = await apiFetch<{ sent: boolean; reason?: string; notificationsCreated?: number }>(
        "/api/employees/birthdays/wish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toEmployeeId: employeeId }),
        }
      );
      if (res.sent) setWishHint("Wish sent.");
      else if (res.reason === "noLinkedUser") setWishHint("This person has no linked login yet.");
      else setWishHint("Already sent today, or could not deliver.");
    } catch (e) {
      setWishHint(e instanceof Error ? e.message : "Could not send wish.");
    } finally {
      setWishBusyId(null);
      window.setTimeout(() => setWishHint(null), 4000);
    }
  }

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      /* ignore */
    }
  }

  async function markAllCompanyRead() {
    const unread = notices.filter((n) => !n.readAt);
    if (unread.length === 0) return;
    setMarkingAll(true);
    try {
      for (const n of unread) {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      }
      setNotices((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } finally {
      setMarkingAll(false);
    }
  }

  const hubHref = scrollAnchorHref ?? `${ROUTES.employeeProfile}#birthdays-notices`;
  const hasUnreadNotices = notices.some((n) => !n.readAt);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/[0.06]"
      aria-labelledby="birthdays-notices-heading"
    >
      {/* Header — gift, title, kebab */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1a92d5] text-xl text-white shadow-md shadow-sky-600/25">
            🎁
          </span>
          <div className="min-w-0">
            <h2 id="birthdays-notices-heading" className="text-lg font-bold tracking-tight text-[#0d47a1]">
              Birthdays &amp; Company Notices
            </h2>
            <p className="text-sm text-slate-500">Celebrate moments. Stay informed.</p>
          </div>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Widget options"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  void load();
                }}
              >
                <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {wishHint ? (
        <p className="border-t border-slate-100 bg-emerald-50/90 px-5 py-2.5 text-center text-sm font-medium text-emerald-900 sm:px-6">
          {wishHint}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a92d5]" />
        </div>
      ) : err ? (
        <p className="border-t border-slate-100 px-5 py-10 text-center text-sm text-red-600 sm:px-6">{err}</p>
      ) : (
        <>
          {/* Two birthday columns + vertical divider */}
          <div className="grid border-t border-slate-200 lg:grid-cols-2">
            {/* Today */}
            <div className="border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-slate-200">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-lg text-sky-600" aria-hidden>
                  🎂
                </span>
                <h3 className="text-[15px] font-bold text-[#1565C9]">Today&apos;s Birthdays</h3>
                <span aria-hidden>🎉</span>
                <span className="ml-0.5 inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-bold text-sky-800">
                  {today.length}
                </span>
              </div>
              {today.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-8 text-center text-sm text-slate-500">
                  No birthdays today in your People scope.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {today.map((p) => (
                    <li
                      key={`${p.employeeId}-${p.occasionDate}`}
                      id={`birthday-wish-target-${p.employeeId}`}
                      className={`flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow ${
                        wishHighlightId === p.employeeId ? "ring-2 ring-sky-500 ring-offset-2" : ""
                      }`}
                    >
                      {p.profileImageUrl ? (
                        <img
                          src={`${API_BASE_URL}${p.profileImageUrl}`}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
                        />
                      ) : (
                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2B7DE9] to-indigo-600 text-sm font-bold text-white ring-2 ring-slate-100">
                          {p.fullName
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">{p.fullName}</p>
                        <p className="truncate text-sm text-slate-500">{p.departmentName?.trim() || "—"}</p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#1565C9]">
                          <span className="text-base leading-none" aria-hidden>
                            🎂
                          </span>
                          {formatMd(p.occasionDate)}
                        </p>
                        <button
                          type="button"
                          disabled={wishBusyId === p.employeeId}
                          onClick={() => void sendWish(p.employeeId)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-500 bg-white px-3.5 py-2 text-xs font-bold text-emerald-600 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                        >
                          Send Wish
                          <span className="text-sm leading-none" aria-hidden>
                            🎂
                          </span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <BirthdaysHubLink
                href={hubHref}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1565C9] hover:underline"
              >
                View All Birthdays
                <ChevronRight />
              </BirthdaysHubLink>
            </div>

            {/* Upcoming */}
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-base leading-none text-violet-700 shadow-inner ring-1 ring-violet-200/70">
                    📅
                  </span>
                  <span className="text-sm leading-none text-violet-500">✨</span>
                </span>
                <h3 className="text-[15px] font-bold text-violet-800">Upcoming Birthdays</h3>
                <span className="ml-0.5 inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-bold text-violet-900">
                  {upcoming.length}
                </span>
              </div>
              {upcoming.length === 0 ? (
                <p className="rounded-xl border border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-8 text-center text-sm text-slate-600">
                  No upcoming birthdays in the next week.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {upcoming.slice(0, 8).map((p) => {
                    const d = new Date(`${p.occasionDate}T12:00:00Z`);
                    const mon = Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
                    const day = Number.isNaN(d.getTime()) ? "—" : String(d.getUTCDate()).padStart(2, "0");
                    return (
                      <li
                        key={`${p.employeeId}-${p.occasionDate}`}
                        id={`birthday-wish-target-${p.employeeId}`}
                        className={`flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/35 px-3 py-2.5 transition-shadow ${
                          wishHighlightId === p.employeeId ? "ring-2 ring-violet-500 ring-offset-2" : ""
                        }`}
                      >
                        <div className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-content-center rounded-xl bg-violet-100 text-center shadow-inner ring-1 ring-violet-200/60">
                          <span className="text-[10px] font-extrabold leading-none tracking-wide text-violet-700">{mon}</span>
                          <span className="mt-0.5 text-base font-extrabold leading-none text-violet-900">{day}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900">{p.fullName}</p>
                          <p className="truncate text-sm text-slate-500">{p.departmentName?.trim() || "—"}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <BirthdaysHubLink
                href={hubHref}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1565C9] hover:underline"
              >
                View All Upcoming
                <ChevronRight />
              </BirthdaysHubLink>
            </div>
          </div>

          {/* Company notices */}
          <div className="border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0d47a1]">
                <span className="text-lg" aria-hidden>
                  📣
                </span>
                Company Notices
              </h3>
              <BirthdaysHubLink href={hubHref} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1565C9] hover:underline">
                View All Notices
                <ChevronRight />
              </BirthdaysHubLink>
            </div>

            <div className="px-5 pb-2 sm:px-6">
              {notices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-8 text-center text-sm text-slate-500">
                  No notices in your inbox yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {notices.slice(0, 6).map((n) => {
                    const kind = classifyNotice(n.category);
                    const label = noticeLabel(kind);
                    const unread = !n.readAt;
                    const line = (n.body?.trim() || n.title).trim();
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void markRead(n.id)}
                          className="flex w-full items-stretch gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-left transition hover:border-sky-200 hover:bg-white"
                        >
                          <NoticeIcon kind={kind} />
                          <span className="min-w-0 flex-1">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pillClass(kind)}`}>
                              {label}
                            </span>
                            <span className="mt-2 block text-sm font-medium leading-snug text-slate-800">{line}</span>
                            <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                              </svg>
                              {formatNoticeDate(n.createdAt)}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-center justify-center self-center pl-1">
                            {unread ? (
                              <span className="h-2 w-2 rounded-full bg-[#1a92d5]" title="Unread" aria-label="Unread" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-2 border-t border-slate-100 bg-sky-50/80 px-5 py-3 sm:px-6">
              <button
                type="button"
                disabled={markingAll || !hasUnreadNotices}
                onClick={() => void markAllCompanyRead()}
                className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#1565C9] transition hover:text-[#0d47a1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 9" />
                </svg>
                {markingAll ? "Marking…" : "Mark all as read"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function BirthdaysCompanyNoticesWidget(props: BirthdaysCompanyNoticesWidgetProps) {
  return (
    <Suspense
      fallback={
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/[0.06]">
          <div className="flex min-h-[220px] items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#1a92d5]" />
          </div>
        </section>
      }
    >
      <BirthdaysCompanyNoticesWidgetInner {...props} />
    </Suspense>
  );
}
