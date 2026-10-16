"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ROUTES } from "@/config/routes";
import { resolveAssetUrl } from "@/config/constants";
import { contextualHelpGuideHref } from "@/lib/help-topics";
import { HeaderCalendarPopover } from "@/components/navigation/HeaderCalendarPopover";
import { HeaderPunchControl } from "@/components/navigation/HeaderPunchControl";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { apiFetch } from "@/lib/api";
import { isVisibleHeaderNotification, shouldMarkReadFromHeader } from "@/lib/notification-visibility";

const iconStroke = 1.75;

/** Glass command-bar icon button (see `.osky-ib` in globals.css). */
const iconBtn = "osky-ib";

function Divider() {
  return <span className="osky-divider hidden sm:block" aria-hidden />;
}

export type AppGlobalHeaderUser = {
  username: string;
  email: string;
  employeeName: string | null;
  employeeId: string | null;
  profileImageUrl: string | null;
  licensedModules?: string[];
};

type AppGlobalHeaderProps = {
  user: AppGlobalHeaderUser;
  onLogout: () => void;
};

type NotificationInboxItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt: string | null;
  sourceUserId?: string | null;
};

type NotificationInboxResponse = {
  items: NotificationInboxItem[];
  unreadCount: number;
};

type BirthdayTodayParsed = { kind: "today"; department?: string; isoDate: string; employeeId?: string };
type BirthdayUpcomingParsed = { kind: "upcoming"; inDays: number; shortDate: string; isoDate: string; employeeId?: string };
type BirthdayParsed = BirthdayTodayParsed | BirthdayUpcomingParsed;

function readEmployeeIdFromBirthdayJson(j: Record<string, unknown>): string | undefined {
  const raw = j.employeeId;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim();
}

function parseBirthdayNotification(category: string, body: string): BirthdayParsed | null {
  if (category !== "BirthdayToday" && category !== "BirthdayUpcoming") return null;
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const employeeId = readEmployeeIdFromBirthdayJson(j);
    if (category === "BirthdayToday") {
      const isoDate = typeof j.isoDate === "string" ? j.isoDate : "";
      if (!isoDate) return null;
      const department = typeof j.department === "string" ? j.department : undefined;
      return { kind: "today", department, isoDate, employeeId };
    }
    const inDays = typeof j.inDays === "number" ? j.inDays : Number(j.inDays);
    const shortDate = typeof j.shortDate === "string" ? j.shortDate : "";
    const isoDate = typeof j.isoDate === "string" ? j.isoDate : "";
    if (!Number.isFinite(inDays) || !shortDate || !isoDate) return null;
    return { kind: "upcoming", inDays, shortDate, isoDate, employeeId };
  } catch {
    return null;
  }
}

/** Birthdays widget: deep-link to People profile, own Employee 360, or Command Center on the dashboard. */
function birthdaysNoticesTargetHref(pathname: string, employeeId: string | undefined): string {
  const peopleMatch = pathname.match(/^(\/app\/people\/[a-f0-9-]{36})\/?$/i);
  if (peopleMatch) {
    const q = employeeId ? `?birthdayWish=${encodeURIComponent(employeeId)}` : "";
    return `${peopleMatch[1]}${q}#birthdays-notices`;
  }
  if (pathname === ROUTES.employeeProfile || pathname.startsWith(`${ROUTES.employeeProfile}/`)) {
    return `${ROUTES.dashboard}#dashboard-birthdays`;
  }
  return `${ROUTES.dashboard}#dashboard-birthdays`;
}

function sortNotificationInbox(items: NotificationInboxItem[]): NotificationInboxItem[] {
  const rank = (n: NotificationInboxItem) => {
    if (n.category === "BirthdayToday") return 0;
    if (n.category === "BirthdayUpcoming") return 1;
    if (n.category === "BirthdayWish" || n.category === "BirthdayWishReply" || n.category === "BirthdayWishSent")
      return 2;
    return 3;
  };
  return [...items].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.category === "BirthdayUpcoming" && b.category === "BirthdayUpcoming") {
      const pa = parseBirthdayNotification(a.category, a.body);
      const pb = parseBirthdayNotification(b.category, b.body);
      if (pa?.kind === "upcoming" && pb?.kind === "upcoming") {
        const c = pa.isoDate.localeCompare(pb.isoDate);
        if (c !== 0) return c;
      }
    }
    return a.title.localeCompare(b.title);
  });
}

/** One inbox row: object (camelCase or PascalCase) or JSON array from positional record serialization. */
function parseNotificationInboxRow(row: unknown): NotificationInboxItem | null {
  if (Array.isArray(row)) {
    const a = row;
    const idVal = a[0];
    const id = idVal != null && idVal !== "" ? String(idVal) : "";
    if (!id) return null;
    const readRaw = a[5];
    return {
      id,
      title: String(a[1] ?? ""),
      body: String(a[2] ?? ""),
      category: String(a[3] ?? ""),
      createdAt: String(a[4] ?? ""),
      readAt: readRaw == null || readRaw === "" ? null : String(readRaw),
      sourceUserId: a[6] == null || a[6] === "" ? undefined : String(a[6]),
    };
  }
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const idVal = r.id ?? r.Id;
  const id = idVal != null && idVal !== "" ? String(idVal) : "";
  if (!id) return null;
  const readRaw = r.readAt ?? r.ReadAt;
  const readAt = readRaw == null || readRaw === "" ? null : String(readRaw);
  const su = r.sourceUserId ?? r.SourceUserId;
  return {
    id,
    title: String(r.title ?? r.Title ?? ""),
    body: String(r.body ?? r.Body ?? ""),
    category: String(r.category ?? r.Category ?? ""),
    createdAt: String(r.createdAt ?? r.CreatedAt ?? ""),
    readAt,
    sourceUserId: su == null ? undefined : String(su),
  };
}

/** API may return camelCase or PascalCase; items may be objects or JSON arrays. */
function normalizeNotificationInbox(data: unknown): NotificationInboxResponse {
  if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[0])) {
    const uc = data[1];
    const items: NotificationInboxItem[] = [];
    for (const row of data[0] as unknown[]) {
      const one = parseNotificationInboxRow(row);
      if (one) items.push(one);
    }
    return {
      items,
      unreadCount: typeof uc === "number" && Number.isFinite(uc) ? uc : 0,
    };
  }
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawItems = d.items ?? d.Items;
  const items: NotificationInboxItem[] = [];
  if (Array.isArray(rawItems)) {
    for (const row of rawItems) {
      const one = parseNotificationInboxRow(row);
      if (one) items.push(one);
    }
  }
  const uc = d.unreadCount ?? d.UnreadCount;
  const unreadCount = typeof uc === "number" && Number.isFinite(uc) ? uc : 0;
  return { items, unreadCount };
}

export function AppGlobalHeader({ user, onLogout }: AppGlobalHeaderProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isPeopleSection = pathname === ROUTES.people || pathname.startsWith(`${ROUTES.people}/`);

  const displayName = user.employeeName?.trim() || user.username;
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [langOpen, setLangOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifUnread, setNotifUnread] = React.useState(0);
  const [notifItems, setNotifItems] = React.useState<NotificationInboxItem[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);

  const refreshUnreadCount = React.useCallback(async () => {
    try {
      const data = await apiFetch<unknown>("/api/notifications/unread-count");
      const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const uc = d.unreadCount ?? d.UnreadCount;
      setNotifUnread(typeof uc === "number" && Number.isFinite(uc) ? uc : 0);
    } catch {
      /* logged out or API down */
    }
  }, []);

  const loadInbox = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setNotifLoading(true);
      setNotifError(null);
    }
    try {
      const data = await apiFetch<unknown>("/api/notifications?take=100");
      const inbox = normalizeNotificationInbox(data);
      const filtered = inbox.items.filter(
        (n) => n.category !== "BirthdayWishMyReply" && isVisibleHeaderNotification(n)
      );
      setNotifItems(sortNotificationInbox(filtered));
      setNotifUnread(inbox.unreadCount);
    } catch (e) {
      if (!opts?.silent) {
        setNotifError(e instanceof Error ? e.message : "Could not load notifications.");
      }
    } finally {
      if (!opts?.silent) setNotifLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshUnreadCount();
    void loadInbox({ silent: true });
    const id = window.setInterval(() => void refreshUnreadCount(), 120_000);
    return () => window.clearInterval(id);
  }, [refreshUnreadCount, loadInbox]);

  React.useEffect(() => {
    if (notifOpen) void loadInbox();
  }, [notifOpen, loadInbox]);

  React.useEffect(() => {
    function onNotificationsChanged() {
      void refreshUnreadCount();
      void loadInbox({ silent: true });
    }
    window.addEventListener("opensky:notifications-changed", onNotificationsChanged);
    return () => window.removeEventListener("opensky:notifications-changed", onNotificationsChanged);
  }, [refreshUnreadCount, loadInbox]);

  const helpIconHref = contextualHelpGuideHref(pathname, user.licensedModules);

  return (
    <header className="osky-bar" role="banner">
      <span className="osky-grow" aria-hidden />
      <div className="flex items-center gap-0.5 sm:gap-1">
        <HeaderPunchControl employeeId={user.employeeId} licensedModules={user.licensedModules} />
        <HeaderCalendarPopover iconBtnClass={iconBtn} iconStroke={iconStroke} />
        <ThemeToggle />

        <Popover.Root open={notifOpen} onOpenChange={setNotifOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={`${iconBtn} relative`}
              title="Notifications"
              aria-label="Notifications"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {notifUnread > 0 ? (
                <span className="osky-badge">{notifUnread > 99 ? "99+" : notifUnread}</span>
              ) : null}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[10050] w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200/90 bg-white p-0 shadow-lg shadow-slate-900/10 outline-none"
              sideOffset={8}
              align="end"
              collisionPadding={12}
            >
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
                <p className="text-[11px] text-slate-500">
                  People: birthdays, licenses, probation & retirement
                </p>
              </div>
              <div className="max-h-[min(70vh,22rem)] overflow-y-auto px-2 py-2">
                {notifLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : notifError ? (
                  <p className="px-2 py-4 text-center text-sm text-red-600">{notifError}</p>
                ) : notifItems.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {notifItems.map((n) => {
                      const unread = !n.readAt;
                      const bd = parseBirthdayNotification(n.category, n.body);
                      const goBioBirthdaysWidget =
                        n.category === "BirthdayToday" ||
                        n.category === "BirthdayUpcoming" ||
                        n.category === "BirthdayWish" ||
                        n.category === "BirthdayWishReply" ||
                        n.category === "BirthdayWishSent";
                      const unreadAccent = unread && goBioBirthdaysWidget;
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            className={`flex w-full gap-2 rounded-lg py-2.5 pl-2 pr-2 text-left text-sm transition hover:bg-slate-50 ${
                              unread && !goBioBirthdaysWidget ? "bg-sky-50/80" : ""
                            } ${unreadAccent ? "border-l-[5px] border-l-violet-600 pl-1.5" : "border-l-[5px] border-l-transparent pl-1.5"}`}
                            onClick={async () => {
                              if (goBioBirthdaysWidget) {
                                setNotifOpen(false);
                                const focusId =
                                  bd?.kind === "today" || bd?.kind === "upcoming" ? bd.employeeId : undefined;
                                const target = birthdaysNoticesTargetHref(pathname, focusId);
                                router.push(target);
                              }
                              if (!unread || !shouldMarkReadFromHeader(n.category)) return;
                              try {
                                await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
                                setNotifItems((prev) =>
                                  sortNotificationInbox(
                                    prev.map((x) =>
                                      x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x
                                    )
                                  )
                                );
                                await refreshUnreadCount();
                                await loadInbox({ silent: true });
                                window.dispatchEvent(new Event("opensky:notifications-changed"));
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {bd?.kind === "today" ? (
                              <span className="shrink-0 select-none text-base leading-tight" aria-hidden>
                                🎂
                              </span>
                            ) : n.category === "BirthdayWish" || n.category === "BirthdayWishSent" ? (
                              <span className="shrink-0 select-none text-base leading-tight" aria-hidden>
                                🎉
                              </span>
                            ) : n.category === "BirthdayWishReply" ? (
                              <span className="shrink-0 select-none text-base leading-tight" aria-hidden>
                                💬
                              </span>
                            ) : (
                              <span className="w-5 shrink-0" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-slate-900">{n.title}</span>
                              {bd?.kind === "today" ? (
                                <>
                                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                                    {bd.department?.trim() ? bd.department : "—"}
                                  </span>
                                  <span className="block text-[13px] leading-snug text-slate-500">{bd.isoDate}</span>
                                </>
                              ) : null}
                              {bd?.kind === "upcoming" ? (
                                <>
                                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">
                                    In {bd.inDays} {bd.inDays === 1 ? "day" : "days"} · {bd.shortDate}
                                  </span>
                                  <span className="block text-[13px] leading-snug text-slate-500">{bd.isoDate}</span>
                                </>
                              ) : null}
                              {!bd ? (
                                <>
                                  <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{n.body}</span>
                                  <span className="mt-1 block text-[11px] text-slate-400">
                                    {new Date(n.createdAt).toLocaleString(undefined, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                </>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {isPeopleSection ? (
          <Link
            href={helpIconHref}
            className={iconBtn}
            title="Help for this area"
            aria-label="Help for this area"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
          </Link>
        ) : (
          <Link href={helpIconHref} className={iconBtn} title="Help for this area" aria-label="Help for this area">
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
          </Link>
        )}

        <Link href={ROUTES.reports} className={iconBtn} title="Reports & feeds" aria-label="Reports and feeds">
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={iconStroke} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7" />
            <circle cx="6" cy="19" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </Link>

        <Divider />

        <Popover.Root open={langOpen} onOpenChange={setLangOpen}>
          <Popover.Trigger asChild>
            <button type="button" className="osky-lang" aria-label="Language">
              EN
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[10050] min-w-[10rem] rounded-xl border border-slate-200/90 bg-white p-2 shadow-lg shadow-slate-900/10 outline-none"
              sideOffset={6}
              align="end"
              collisionPadding={12}
            >
              <p className="px-2 py-1.5 text-xs font-semibold text-slate-500">Language</p>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">English</div>
              <p className="mt-2 px-2 text-[11px] leading-snug text-slate-400">More languages can be added when i18n is enabled.</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <Divider />

        <Popover.Root open={accountOpen} onOpenChange={setAccountOpen}>
          <Popover.Trigger asChild>
            <button type="button" className="osky-ubtn" aria-label="Account menu">
              {user.profileImageUrl ? (
                <span className="osky-av">
                  <img src={resolveAssetUrl(user.profileImageUrl) ?? ""} alt="" />
                </span>
              ) : (
                <span className="osky-av">{initials}</span>
              )}
              <span className="hidden truncate sm:inline">{displayName}</span>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--ink-3)" }} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[10050] w-[min(100vw-2rem,16rem)] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 outline-none"
              sideOffset={8}
              align="end"
              collisionPadding={12}
            >
              <p className="truncate px-2.5 pb-1 pt-1 text-xs text-slate-500">{user.email}</p>
              <button
                type="button"
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                onClick={() => {
                  setAccountOpen(false);
                  onLogout();
                }}
              >
                Sign out
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  );
}
