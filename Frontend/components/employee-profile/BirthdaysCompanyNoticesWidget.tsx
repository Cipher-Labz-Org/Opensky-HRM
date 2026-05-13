"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";

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
  sourceUserId?: string | null;
};

type InboxResponse = {
  items: NoticeItem[];
  unreadCount: number;
};

type BirthdayWishThreadMessageDto = {
  fromWisher: boolean;
  body: string;
  createdAt: string;
};

type BirthdayWishThreadDto = {
  wishNotificationId: string;
  wishTitle: string;
  messages: BirthdayWishThreadMessageDto[];
};

const digestCategories = new Set(["BirthdayToday", "BirthdayUpcoming", "EmployeeBirthdayDigest"]);
const inboxHiddenCategories = new Set([...digestCategories, "BirthdayWishMyReply"]);

/** One-tap inserts for birthday wish messages (UTF-16 safe slice/length in textarea). */
const WISH_QUICK_EMOJIS = ["🎉", "🎂", "🎁", "🥳", "❤️", "✨", "🙌", "👏", "💐", "😊", "⭐", "🍰"] as const;

type NoticeKind = "important" | "event" | "reminder" | "wish" | "reply" | "notice";

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

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function classifyNotice(category: string): NoticeKind {
  const c = category.toLowerCase();
  if (c === "birthdaywish") return "wish";
  if (c === "birthdaywishreply") return "reply";
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
    case "reply":
      return "Reply";
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
  if (kind === "reply") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-base" aria-hidden>
        💬
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
    case "reply":
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
    default:
      return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
  }
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
    </svg>
  );
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

function sortNoticesForDisplay(items: NoticeItem[]): NoticeItem[] {
  const wishRank = (c: string) => (c === "BirthdayWish" || c === "BirthdayWishReply" ? 0 : 1);
  return [...items].sort((a, b) => {
    const aw = wishRank(a.category);
    const bw = wishRank(b.category);
    if (aw !== bw) return aw - bw;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function BirthdaysCompanyNoticesWidgetInner({ scrollAnchorHref }: BirthdaysCompanyNoticesWidgetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const myEmployeeId = user?.employeeId?.trim() ?? "";
  const wishFocusParam = searchParams.get("birthdayWish")?.trim() ?? "";

  const [summary, setSummary] = React.useState<BirthdaySummary | null>(null);
  const [notices, setNotices] = React.useState<NoticeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [wishBusyId, setWishBusyId] = React.useState<string | null>(null);
  const [wishHint, setWishHint] = React.useState<string | null>(null);
  /** Optional personal note per recipient (today's birthdays), keyed by employee id. */
  const [wishNoteByEmployee, setWishNoteByEmployee] = React.useState<Record<string, string>>({});
  const [replyDraftByNotice, setReplyDraftByNotice] = React.useState<Record<string, string>>({});
  const [replyBusyNoticeId, setReplyBusyNoticeId] = React.useState<string | null>(null);
  const [wishThreadsByNoticeId, setWishThreadsByNoticeId] = React.useState<Record<string, BirthdayWishThreadDto>>({});
  const [markingAll, setMarkingAll] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [wishHighlightId, setWishHighlightId] = React.useState<string | null>(null);

  const upcomingScrollerRef = React.useRef<HTMLDivElement>(null);
  const [upcomingSlideIdx, setUpcomingSlideIdx] = React.useState(0);
  const upcomingLimited = React.useMemo(() => (summary?.upcoming ?? []).slice(0, 80), [summary]);
  const upcomingScrollKey = React.useMemo(
    () => upcomingLimited.map((p) => `${p.employeeId}-${p.occasionDate}`).join("|"),
    [upcomingLimited],
  );

  const handleUpcomingCarouselScroll = React.useCallback(() => {
    const el = upcomingScrollerRef.current;
    if (!el || upcomingLimited.length <= 1) return;
    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    setUpcomingSlideIdx(Math.min(Math.max(0, idx), upcomingLimited.length - 1));
  }, [upcomingLimited.length]);

  const scrollToUpcomingSlide = React.useCallback(
    (idx: number) => {
      const el = upcomingScrollerRef.current;
      if (!el || upcomingLimited.length === 0) return;
      const w = el.clientWidth || 1;
      const clamped = Math.max(0, Math.min(idx, upcomingLimited.length - 1));
      el.scrollTo({ left: clamped * w, behavior: "smooth" });
      setUpcomingSlideIdx(clamped);
    },
    [upcomingLimited.length],
  );

  React.useEffect(() => {
    setUpcomingSlideIdx(0);
    const el = upcomingScrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [upcomingScrollKey]);

  React.useEffect(() => {
    const el = upcomingScrollerRef.current;
    if (!el || upcomingLimited.length <= 1) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1;
      if (w < 1) return;
      const idx = Math.min(Math.max(0, Math.round(el.scrollLeft / w)), upcomingLimited.length - 1);
      el.scrollLeft = idx * w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [upcomingLimited.length, upcomingScrollKey]);

  const load = React.useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [bd, inbox] = await Promise.all([
        apiFetch<BirthdaySummary>("/api/employees/birthdays/summary"),
        apiFetch<InboxResponse>("/api/notifications?take=100"),
      ]);
      setSummary({
        today: Array.isArray(bd.today) ? bd.today : [],
        upcoming: Array.isArray(bd.upcoming) ? bd.upcoming : [],
      });
      const items = Array.isArray(inbox.items) ? inbox.items : [];
      const sorted = sortNoticesForDisplay(items.filter((n) => !inboxHiddenCategories.has(n.category)));
      setNotices(sorted);

      const wishes = sorted.filter((n) => n.category === "BirthdayWish");
      const nextThreads: Record<string, BirthdayWishThreadDto> = {};
      await Promise.all(
        wishes.map(async (w) => {
          try {
            nextThreads[w.id] = await apiFetch<BirthdayWishThreadDto>(
              `/api/notifications/birthday-wish/${w.id}/thread`
            );
          } catch {
            /* ignore per-thread errors */
          }
        })
      );
      setWishThreadsByNoticeId(nextThreads);
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

  const insertWishEmoji = React.useCallback((employeeId: string, emoji: string) => {
    if (wishBusyId === employeeId) return;
    const ta = document.getElementById(`birthday-wish-note-${employeeId}`) as HTMLTextAreaElement | null;
    setWishNoteByEmployee((prev) => {
      const current = prev[employeeId] ?? "";
      let start = current.length;
      let end = current.length;
      if (ta && document.activeElement === ta) {
        start = ta.selectionStart ?? 0;
        end = ta.selectionEnd ?? start;
      }
      const merged = current.slice(0, start) + emoji + current.slice(end);
      if (merged.length > 500) return prev;
      const taId = `birthday-wish-note-${employeeId}`;
      const selStart = start;
      const addLen = emoji.length;
      queueMicrotask(() => {
        try {
          const el = document.getElementById(taId) as HTMLTextAreaElement | null;
          if (!el?.isConnected) return;
          el.focus();
          const pos = selStart + addLen;
          el.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      });
      return { ...prev, [employeeId]: merged };
    });
  }, [wishBusyId]);

  const insertReplyEmoji = React.useCallback((noticeId: string, emoji: string) => {
    if (replyBusyNoticeId === noticeId) return;
    const taId = `birthday-reply-draft-${noticeId}`;
    const ta = document.getElementById(taId) as HTMLTextAreaElement | null;
    setReplyDraftByNotice((prev) => {
      const current = prev[noticeId] ?? "";
      let start = current.length;
      let end = current.length;
      if (ta && document.activeElement === ta) {
        start = ta.selectionStart ?? 0;
        end = ta.selectionEnd ?? start;
      }
      const merged = current.slice(0, start) + emoji + current.slice(end);
      if (merged.length > 500) return prev;
      const selStart = start;
      const addLen = emoji.length;
      queueMicrotask(() => {
        try {
          const el = document.getElementById(taId) as HTMLTextAreaElement | null;
          if (!el?.isConnected) return;
          el.focus();
          const pos = selStart + addLen;
          el.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      });
      return { ...prev, [noticeId]: merged };
    });
  }, [replyBusyNoticeId]);

  async function sendWish(employeeId: string) {
    setWishHint(null);
    setWishBusyId(employeeId);
    const message = (wishNoteByEmployee[employeeId] ?? "").trim();
    try {
      const res = await apiFetch<{ sent: boolean; reason?: string; notificationsCreated?: number }>(
        "/api/employees/birthdays/wish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmployeeId: employeeId,
            ...(message.length > 0 ? { message } : {}),
          }),
        }
      );
      if (res.sent) {
        setWishHint("Wish sent.");
        setWishNoteByEmployee((prev) => {
          const next = { ...prev };
          delete next[employeeId];
          return next;
        });
      } else if (res.reason === "noLinkedUser") setWishHint("This person has no linked login yet.");
      else if (res.reason === "noOtherRecipients")
        setWishHint("There is no other login linked to this employee to notify (you cannot wish yourself).");
      else setWishHint("Already sent today, or could not deliver.");
    } catch (e) {
      setWishHint(e instanceof Error ? e.message : "Could not send wish.");
    } finally {
      setWishBusyId(null);
      window.setTimeout(() => setWishHint(null), 4000);
    }
  }

  async function sendWishReply(noticeId: string) {
    const text = (replyDraftByNotice[noticeId] ?? "").trim();
    if (!text) {
      setWishHint("Type a reply first.");
      window.setTimeout(() => setWishHint(null), 3000);
      return;
    }
    setWishHint(null);
    setReplyBusyNoticeId(noticeId);
    try {
      await apiFetch(`/api/notifications/${noticeId}/birthday-wish-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      setWishHint("Reply sent.");
      setReplyDraftByNotice((prev) => {
        const next = { ...prev };
        delete next[noticeId];
        return next;
      });
      await markRead(noticeId);
      await load();
    } catch (e) {
      setWishHint(e instanceof Error ? e.message : "Could not send reply.");
    } finally {
      setReplyBusyNoticeId(null);
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
                        {myEmployeeId && p.employeeId === myEmployeeId ? (
                          <p className="mt-3 text-xs font-medium text-slate-500">Others can send you a wish from their account.</p>
                        ) : (
                          <>
                            <label htmlFor={`birthday-wish-note-${p.employeeId}`} className="sr-only">
                              Personal message for {p.fullName} (optional)
                            </label>
                            <textarea
                              id={`birthday-wish-note-${p.employeeId}`}
                              rows={2}
                              maxLength={500}
                              value={wishNoteByEmployee[p.employeeId] ?? ""}
                              onChange={(e) =>
                                setWishNoteByEmployee((prev) => ({ ...prev, [p.employeeId]: e.target.value }))
                              }
                              disabled={wishBusyId === p.employeeId}
                              placeholder="Add a personal message (optional, max 500 characters). Tap emoji below or use your device emoji keyboard."
                              className="mt-2 min-h-[2.75rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
                            />
                            <div
                              className="mt-1.5 flex flex-wrap items-center gap-1"
                              role="toolbar"
                              aria-label="Insert emoji into wish message"
                            >
                              <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                Emoji
                              </span>
                              {WISH_QUICK_EMOJIS.map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  disabled={wishBusyId === p.employeeId}
                                  title={`Insert ${em}`}
                                  onClick={() => insertWishEmoji(p.employeeId, em)}
                                  className="grid h-8 min-w-[2rem] shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg leading-none transition hover:border-emerald-300 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-40"
                                >
                                  <span aria-hidden>{em}</span>
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={wishBusyId === p.employeeId}
                              onClick={() => void sendWish(p.employeeId)}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-500 bg-white px-3.5 py-2 text-xs font-bold text-emerald-600 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                            >
                              Send Wish
                              <span className="text-sm leading-none" aria-hidden>
                                🎂
                              </span>
                            </button>
                          </>
                        )}
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
                  No upcoming birthdays in the next 30 days.
                </p>
              ) : (
                <div
                  role="region"
                  aria-roledescription="carousel"
                  aria-label="Upcoming birthdays"
                >
                  <div
                    className={`flex items-center ${upcomingLimited.length > 1 ? "gap-2" : ""}`}
                  >
                    {upcomingLimited.length > 1 ? (
                      <button
                        type="button"
                        aria-label="Previous upcoming birthday"
                        disabled={upcomingSlideIdx <= 0}
                        onClick={() => scrollToUpcomingSlide(upcomingSlideIdx - 1)}
                        className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full border border-violet-200/90 bg-white text-violet-800 shadow-sm transition hover:bg-violet-50 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    ) : null}
                    <div className={upcomingLimited.length > 1 ? "min-w-0 flex-1" : "min-w-0 w-full"}>
                      <div
                        ref={upcomingScrollerRef}
                        onScroll={handleUpcomingCarouselScroll}
                        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {upcomingLimited.map((p) => {
                          const d = new Date(`${p.occasionDate}T12:00:00Z`);
                          const mon = Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
                          const day = Number.isNaN(d.getTime()) ? "—" : String(d.getUTCDate()).padStart(2, "0");
                          return (
                            <article
                              key={`${p.employeeId}-${p.occasionDate}`}
                              id={`birthday-wish-target-${p.employeeId}`}
                              aria-roledescription="slide"
                              aria-label={`${p.fullName}, ${mon} ${day}`}
                              className="min-w-0 w-full shrink-0 grow-0 basis-full snap-start snap-always"
                            >
                              <div
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
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                    {upcomingLimited.length > 1 ? (
                      <button
                        type="button"
                        aria-label="Next upcoming birthday"
                        disabled={upcomingSlideIdx >= upcomingLimited.length - 1}
                        onClick={() => scrollToUpcomingSlide(upcomingSlideIdx + 1)}
                        className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full border border-violet-200/90 bg-white text-violet-800 shadow-sm transition hover:bg-violet-50 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {upcomingLimited.length > 1 ? (
                    <div
                      className="mt-3 flex items-center justify-center gap-2"
                      role="tablist"
                      aria-label="Upcoming birthday slides"
                    >
                      {upcomingLimited.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={upcomingSlideIdx === i}
                          aria-label={`Show birthday ${i + 1} of ${upcomingLimited.length}`}
                          onClick={() => scrollToUpcomingSlide(i)}
                          className={`h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${
                            upcomingSlideIdx === i ? "w-6 bg-violet-600" : "w-2 bg-violet-200 hover:bg-violet-300"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
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

          {/* Company notices — capped height with internal scroll so many wishes don’t push the whole page */}
          <div className="flex min-h-0 max-h-[min(52vh,26rem)] flex-col border-t border-slate-200">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
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

            <div
              className="min-h-0 flex-1 overflow-y-scroll overscroll-y-contain px-5 pb-2 sm:px-6 [scrollbar-gutter:stable]"
              role="region"
              aria-label="Company notices list"
            >
              {notices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-8 text-center text-sm text-slate-500">
                  No notices in your inbox yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5 pb-1 pr-1">
                  {notices.map((n) => {
                    const kind = classifyNotice(n.category);
                    const label = noticeLabel(kind);
                    const unread = !n.readAt;
                    const line = (n.body?.trim() || n.title ?? "").trim();
                    /** All birthday wishes are replyable; API resolves sender from SourceUserId or legacy DedupeKey. */
                    const canReplyToWish = n.category === "BirthdayWish";
                    const replyBusy = replyBusyNoticeId === n.id;
                    const noticeRowRound = canReplyToWish ? "rounded-t-xl" : "rounded-xl";
                    return (
                      <li
                        key={n.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 transition hover:border-sky-200 hover:bg-white"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => void markRead(n.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void markRead(n.id);
                            }
                          }}
                          className={`flex w-full cursor-pointer items-stretch gap-3 p-3 text-left outline-none transition hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${noticeRowRound}`}
                          aria-label={unread ? "Mark notice as read" : "Notice (already read)"}
                        >
                          <NoticeIcon kind={kind} />
                          <span className="min-w-0 flex-1">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pillClass(kind)}`}>
                              {label}
                            </span>
                            <span className="mt-2 block text-sm font-medium leading-snug text-slate-800">{line}</span>
                            <span
                              className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"
                              suppressHydrationWarning
                            >
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
                        </div>
                        {canReplyToWish ? (
                          <div className="relative z-0 rounded-b-xl border-t border-slate-200 bg-white px-3 pb-3 pt-2">
                            {wishThreadsByNoticeId[n.id] ? (
                              <div
                                className="mb-2 max-h-52 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/90 p-2"
                                role="log"
                                aria-label="Birthday wish conversation"
                              >
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Conversation
                                </p>
                                <div className="flex flex-col gap-2">
                                  {wishThreadsByNoticeId[n.id].messages.map((m, idx) => (
                                    <div
                                      key={`${n.id}-chat-${idx}`}
                                      className={
                                        m.fromWisher
                                          ? "max-w-[94%] self-start rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left text-xs leading-snug text-slate-800 shadow-sm"
                                          : "max-w-[94%] self-end rounded-xl border border-emerald-200/90 bg-emerald-50 px-2.5 py-2 text-left text-xs leading-snug text-emerald-950 shadow-sm"
                                      }
                                    >
                                      <span
                                        className="mb-1 block text-[10px] font-medium text-slate-400"
                                        suppressHydrationWarning
                                      >
                                        {m.fromWisher ? "Wish" : "You"} · {formatChatTime(m.createdAt)}
                                      </span>
                                      <span className="whitespace-pre-wrap">{m.body}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <label htmlFor={`birthday-reply-draft-${n.id}`} className="sr-only">
                              Reply to this birthday wish (optional)
                            </label>
                            <div className="flex items-start gap-2">
                              <textarea
                                id={`birthday-reply-draft-${n.id}`}
                                rows={2}
                                maxLength={500}
                                value={replyDraftByNotice[n.id] ?? ""}
                                onChange={(e) =>
                                  setReplyDraftByNotice((prev) => ({ ...prev, [n.id]: e.target.value }))
                                }
                                disabled={replyBusy}
                                placeholder="Add a personal message (optional, max 500 characters). Tap emoji below or use your device emoji keyboard."
                                className="mt-0 min-h-[2.75rem] min-w-0 flex-1 resize-y rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
                              />
                              <button
                                type="button"
                                disabled={replyBusy}
                                onClick={() => void sendWishReply(n.id)}
                                className="inline-flex shrink-0 items-center self-center rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-xs font-bold text-emerald-600 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                                aria-label={replyBusy ? "Sending reply" : "Send reply"}
                              >
                                {replyBusy ? "Sending…" : "Send Reply"}
                              </button>
                            </div>
                            <div
                              className="mt-1.5 flex flex-wrap items-center gap-1"
                              role="toolbar"
                              aria-label="Insert emoji into reply message"
                            >
                              <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                Emoji
                              </span>
                              {WISH_QUICK_EMOJIS.map((em) => (
                                <button
                                  key={`${n.id}-reply-${em}`}
                                  type="button"
                                  disabled={replyBusy}
                                  title={`Insert ${em}`}
                                  onClick={() => insertReplyEmoji(n.id, em)}
                                  className="grid h-8 min-w-[2rem] shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg leading-none transition hover:border-emerald-300 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-40"
                                >
                                  <span aria-hidden>{em}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-0 shrink-0 border-t border-slate-100 bg-sky-50/80 px-5 py-3 sm:px-6">
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
