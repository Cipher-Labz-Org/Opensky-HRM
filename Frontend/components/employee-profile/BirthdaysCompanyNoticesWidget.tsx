"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { useAuth } from "@/contexts/auth-context";

type BirthdayPerson = {
  employeeId: string;
  fullName: string;
  departmentName: string | null;
  profileImageUrl: string | null;
  occasionDate: string;
  isToday: boolean;
  daysUntil: number;
  alreadyWished?: boolean;
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
const inboxHiddenCategories = new Set<string>([
  ...Array.from(digestCategories),
  "BirthdayWishMyReply",
]);

/** One-tap inserts for birthday wish messages (UTF-16 safe slice/length in textarea). */
const WISH_QUICK_EMOJIS = ["🎉", "🎂", "🎁", "🥳", "❤️", "✨", "🙌", "👏", "💐", "😊", "⭐", "🍰"] as const;

type NoticeKind = "important" | "event" | "reminder" | "wish" | "reply" | "notice";

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
  if (c === "birthdaywish" || c === "birthdaywishsent") return "wish";
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

function sortNoticesForDisplay(items: NoticeItem[]): NoticeItem[] {
  const wishRank = (c: string) => (c === "BirthdayWish" || c === "BirthdayWishReply" ? 0 : 1);
  return [...items].sort((a, b) => {
    const aw = wishRank(a.category);
    const bw = wishRank(b.category);
    if (aw !== bw) return aw - bw;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function BirthdaysCompanyNoticesWidgetInner() {
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
  const [wishesPanelOpen, setWishesPanelOpen] = React.useState(false);
  const [selectedWishEmployeeId, setSelectedWishEmployeeId] = React.useState<string | null>(null);
  const [wishedEmployeeIds, setWishedEmployeeIds] = React.useState<Set<string>>(() => new Set());
  const [noticesExpanded, setNoticesExpanded] = React.useState(false);

  const upcomingStripRef = React.useRef<HTMLDivElement>(null);
  const upcomingLimited = React.useMemo(() => (summary?.upcoming ?? []).slice(0, 80), [summary]);

  const scrollUpcomingStrip = React.useCallback((dir: 1 | -1) => {
    const el = upcomingStripRef.current;
    if (!el) return;
    const step = Math.max(120, Math.floor(el.clientWidth * 0.6));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

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
      setWishedEmployeeIds(
        new Set(
          (Array.isArray(bd.today) ? bd.today : [])
            .filter((p) => p.alreadyWished)
            .map((p) => p.employeeId)
        )
      );
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
    if (!wishFocusParam) return;
    const t = summary?.today ?? [];
    if (t.some((p) => p.employeeId === wishFocusParam)) {
      setSelectedWishEmployeeId(wishFocusParam);
      setWishesPanelOpen(true);
    }
  }, [wishFocusParam, summary?.today]);

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

  const isWishablePerson = React.useCallback(
    (employeeId: string) => {
      if (myEmployeeId && employeeId === myEmployeeId) return false;
      return !wishedEmployeeIds.has(employeeId);
    },
    [myEmployeeId, wishedEmployeeIds]
  );

  const pendingWishCount = React.useMemo(
    () => today.filter((p) => isWishablePerson(p.employeeId)).length,
    [today, isWishablePerson]
  );

  const selectedWishPerson = React.useMemo(
    () => (selectedWishEmployeeId ? today.find((p) => p.employeeId === selectedWishEmployeeId) ?? null : null),
    [selectedWishEmployeeId, today]
  );

  const openWishPanelFor = React.useCallback(
    (employeeId: string) => {
      if (!isWishablePerson(employeeId)) return;
      setSelectedWishEmployeeId(employeeId);
      setWishesPanelOpen(true);
    },
    [isWishablePerson]
  );

  const toggleWishesPanel = React.useCallback(() => {
    setWishesPanelOpen((open) => {
      const next = !open;
      if (next && !selectedWishEmployeeId) {
        const first = today.find((p) => isWishablePerson(p.employeeId));
        if (first) setSelectedWishEmployeeId(first.employeeId);
      }
      if (!next) setSelectedWishEmployeeId(null);
      return next;
    });
  }, [selectedWishEmployeeId, today, isWishablePerson]);

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
      const res = await apiFetch<{ sent?: boolean; Sent?: boolean; notificationsCreated?: number; reason?: string }>(
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
      const delivered =
        res.sent === true ||
        res.Sent === true ||
        (typeof res.notificationsCreated === "number" && res.notificationsCreated > 0);
      if (delivered) {
        setWishHint("Wish sent.");
        setWishedEmployeeIds((prev) => {
          const nextSet = new Set([...prev, employeeId]);
          const nextPerson = today.find(
            (p) => p.employeeId !== employeeId && !nextSet.has(p.employeeId) && p.employeeId !== myEmployeeId
          );
          if (nextPerson) setSelectedWishEmployeeId(nextPerson.employeeId);
          else {
            setSelectedWishEmployeeId(null);
            setWishesPanelOpen(false);
          }
          return nextSet;
        });
      } else if (res.reason === "noLinkedUser") setWishHint("This person has no linked login yet.");
      else if (res.reason === "noOtherRecipients")
        setWishHint("There is no other login linked to this employee to notify (you cannot wish yourself).");
      else {
        setWishHint("Already sent today, or could not deliver.");
        setWishedEmployeeIds((prev) => new Set([...prev, employeeId]));
        setSelectedWishEmployeeId(null);
        setWishesPanelOpen(false);
      }
      // Clear draft whenever the server returns 2xx (including noLinkedUser / dedupe cases).
      setWishNoteByEmployee((prev) => ({ ...prev, [employeeId]: "" }));
    } catch (e) {
      setWishHint(e instanceof Error ? e.message : "Could not send wish.");
    } finally {
      setWishBusyId(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("opensky:notifications-changed"));
      }
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("opensky:notifications-changed"));
      }
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

  const hasUnreadNotices = notices.some((n) => !n.readAt);
  const noticesUnreadCount = notices.filter((n) => !n.readAt).length;
  const canSendWishesToOthers = pendingWishCount > 0;

  const renderNoticeRow = (n: NoticeItem) => {
    const kind = classifyNotice(n.category);
    const label = noticeLabel(kind);
    const unread = !n.readAt;
    const line = ((n.body?.trim() || n.title) ?? "").trim();
    const canReplyToWish = n.category === "BirthdayWish";
    const replyBusy = replyBusyNoticeId === n.id;
    const noticeRowRound = canReplyToWish ? "rounded-t-xl" : "rounded-xl";
    return (
      <li
        key={n.id}
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white transition hover:border-violet-200 hover:shadow-sm"
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
          className={`flex w-full cursor-pointer items-stretch gap-3 p-3 text-left outline-none transition hover:bg-violet-50/40 focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${noticeRowRound}`}
          aria-label={unread ? "Mark notice as read" : "Notice (already read)"}
        >
          <NoticeIcon kind={kind} />
          <span className="min-w-0 flex-1">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pillClass(kind)}`}>
              {label}
            </span>
            <span className="mt-2 block text-sm font-medium leading-snug text-slate-800">{line}</span>
            <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500" suppressHydrationWarning>
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
              {formatNoticeDate(n.createdAt)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-center justify-center self-center pl-1">
            {unread ? (
              <span className="h-2 w-2 rounded-full bg-sky-500" title="Unread" aria-label="Unread" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden />
            )}
          </span>
        </div>
        {canReplyToWish ? (
          <div className="relative z-0 rounded-b-xl border-t border-slate-100 bg-slate-50/80 px-3 pb-3 pt-2">
            {wishThreadsByNoticeId[n.id] ? (
              <div
                className="mb-2 max-h-52 overflow-y-auto rounded-lg border border-slate-100 bg-white p-2"
                role="log"
                aria-label="Birthday wish conversation"
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conversation</p>
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
                      <span className="mb-1 block text-[10px] font-medium text-slate-400" suppressHydrationWarning>
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
                onChange={(e) => setReplyDraftByNotice((prev) => ({ ...prev, [n.id]: e.target.value }))}
                disabled={replyBusy}
                placeholder="Add a personal message (optional, max 500 characters). Tap emoji below or use your device emoji keyboard."
                className="mt-0 min-h-[2.75rem] min-w-0 flex-1 resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
              />
              <button
                type="button"
                disabled={replyBusy}
                onClick={() => void sendWishReply(n.id)}
                className="inline-flex shrink-0 items-center self-center rounded-lg border-2 border-violet-500 bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm transition hover:bg-violet-50 disabled:opacity-60"
                aria-label={replyBusy ? "Sending reply" : "Send reply"}
              >
                {replyBusy ? "Sending…" : "Send Reply"}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Insert emoji into reply message">
              <span className="mr-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Emoji</span>
              {WISH_QUICK_EMOJIS.map((em) => (
                <button
                  key={`${n.id}-reply-${em}`}
                  type="button"
                  disabled={replyBusy}
                  title={`Insert ${em}`}
                  onClick={() => insertReplyEmoji(n.id, em)}
                  className="grid h-8 min-w-[2rem] shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg leading-none transition hover:border-violet-300 hover:bg-violet-50 disabled:pointer-events-none disabled:opacity-40"
                >
                  <span aria-hidden>{em}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.07]"
      aria-labelledby="birthdays-notices-heading"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 text-xl shadow-md shadow-violet-600/25 ring-1 ring-violet-500/30">
            🎁
          </span>
          <div className="min-w-0">
            <h2 id="birthdays-notices-heading" className="text-lg font-bold tracking-tight text-slate-800">
              Birthdays &amp; Notices
            </h2>
            <p className="text-sm text-slate-500">Celebrate. Connect. Stay informed.</p>
          </div>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-violet-50 hover:text-slate-700"
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
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-violet-50"
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
        <p className="border-b border-slate-100 bg-emerald-50/95 px-5 py-2.5 text-center text-sm font-medium text-emerald-900 sm:px-6">
          {wishHint}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
        </div>
      ) : err ? (
        <p className="px-5 py-10 text-center text-sm text-red-600 sm:px-6">{err}</p>
      ) : (
        <>
          <div className="grid lg:grid-cols-2">
            {/* Today — left */}
            <div className="border-b border-slate-100 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-slate-100">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-lg leading-none text-violet-600" aria-hidden>
                  🎂
                </span>
                <h3 className="text-[15px] font-bold text-violet-800">Today&apos;s Birthdays</h3>
                <span className="inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-violet-100 px-2 text-xs font-bold text-violet-900">
                  {pendingWishCount}
                </span>
              </div>
              {today.length === 0 ? (
                <p className="rounded-xl border border-dashed border-violet-200/70 bg-violet-50/30 px-4 py-8 text-center text-sm text-slate-600">
                  No birthdays today in your People scope.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {today.map((p) => {
                    const wished = wishedEmployeeIds.has(p.employeeId);
                    const isSelf = Boolean(myEmployeeId && p.employeeId === myEmployeeId);
                    const canSelect = isWishablePerson(p.employeeId);
                    const selected = selectedWishEmployeeId === p.employeeId;
                    return (
                    <li
                      key={`${p.employeeId}-${p.occasionDate}`}
                      id={`birthday-wish-target-${p.employeeId}`}
                      role={canSelect ? "button" : undefined}
                      tabIndex={canSelect ? 0 : undefined}
                      onClick={() => openWishPanelFor(p.employeeId)}
                      onKeyDown={(e) => {
                        if (!canSelect) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openWishPanelFor(p.employeeId);
                        }
                      }}
                      className={`flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm transition ${
                        wished || isSelf ? "opacity-55" : "cursor-pointer hover:border-violet-300 hover:bg-violet-50/40"
                      } ${
                        wishHighlightId === p.employeeId || selected ? "ring-2 ring-violet-500 ring-offset-2" : ""
                      }`}
                      aria-disabled={wished || isSelf || undefined}
                    >
                      {p.profileImageUrl ? (
                        <img
                          src={`${API_BASE_URL}${p.profileImageUrl}`}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-violet-100"
                        />
                      ) : (
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-violet-100">
                          {p.fullName
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-bold ${wished ? "text-slate-500" : "text-slate-900"}`}>{p.fullName}</p>
                        <p className="truncate text-sm text-slate-500">{p.departmentName?.trim() || "—"}</p>
                      </div>
                      {wished ? (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                          Sent
                        </span>
                      ) : (
                      <span className="shrink-0 text-lg leading-none text-violet-400" aria-hidden title="Birthday today">
                        🎂
                      </span>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
              {today.length > 0 ? (
                <button
                  type="button"
                  disabled={!canSendWishesToOthers}
                  title={!canSendWishesToOthers ? "No other recipients to wish today." : undefined}
                  onClick={toggleWishesPanel}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-3 text-sm font-bold text-violet-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden>🎉</span>
                  {wishesPanelOpen ? "Hide wishes" : "Send Wishes"}
                </button>
              ) : null}
            </div>

            {/* Right: Upcoming + Company notices summary */}
            <div className="flex flex-col">
              <div className="flex-1 p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-base text-sky-700 ring-1 ring-sky-200/80" aria-hidden>
                    📅
                  </span>
                  <h3 className="text-[15px] font-bold text-sky-800">Upcoming</h3>
                  <span className="inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-bold text-sky-900">
                    {upcoming.length}
                  </span>
                </div>
                {upcoming.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-sky-200/80 bg-sky-50/40 px-3 py-6 text-center text-xs text-slate-600">
                    No upcoming birthdays in the next 7 days.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    {upcomingLimited.length > 1 ? (
                      <button
                        type="button"
                        aria-label="Scroll upcoming earlier"
                        onClick={() => scrollUpcomingStrip(-1)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sky-200 bg-white text-sky-800 shadow-sm transition hover:bg-sky-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    ) : null}
                    <div
                      ref={upcomingStripRef}
                      className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {upcomingLimited.map((p) => {
                        const d = new Date(`${p.occasionDate}T12:00:00Z`);
                        const mon = Number.isNaN(d.getTime())
                          ? "—"
                          : d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
                        const dayNum = Number.isNaN(d.getTime()) ? "—" : String(d.getUTCDate());
                        return (
                          <div
                            key={`${p.employeeId}-${p.occasionDate}`}
                            className={`flex w-[6.25rem] shrink-0 flex-col rounded-xl border border-sky-200/90 bg-white px-2 py-2.5 text-center shadow-sm ${
                              wishHighlightId === p.employeeId ? "ring-2 ring-sky-500 ring-offset-1" : ""
                            }`}
                          >
                            <span className="text-[10px] font-extrabold leading-none tracking-wide text-sky-600">{mon}</span>
                            <span className="mt-0.5 text-lg font-extrabold leading-none text-sky-800">{dayNum}</span>
                            <span className="mt-2 truncate text-[11px] font-semibold text-slate-800" title={p.fullName}>
                              {p.fullName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {upcomingLimited.length > 1 ? (
                      <button
                        type="button"
                        aria-label="Scroll upcoming later"
                        onClick={() => scrollUpcomingStrip(1)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sky-200 bg-white text-sky-800 shadow-sm transition hover:bg-sky-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setNoticesExpanded((e) => !e)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 px-3 py-3 text-left transition hover:border-sky-200 hover:bg-white"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-200/80 text-base text-slate-600" aria-hidden>
                      🔔
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-slate-800">Company Notices</span>
                      {notices.length === 0 ? (
                        <span className="text-xs text-slate-500">Nothing new</span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {noticesUnreadCount > 0 ? `${noticesUnreadCount} unread` : "All caught up"}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {notices.length > 0 ? (
                      <span className="inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-bold text-sky-900">
                        {notices.length}
                      </span>
                    ) : null}
                    <ChevronRight
                      className={`h-4 w-4 text-violet-600 transition ${noticesExpanded ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible: compose wishes */}
          {wishesPanelOpen && selectedWishPerson && isWishablePerson(selectedWishPerson.employeeId) ? (
            <div className="border-t border-slate-100 bg-violet-50/40 px-5 py-4 sm:px-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-800/80">Personal wish</p>
              <div className="rounded-xl border border-violet-200/80 bg-white p-3 shadow-sm">
                <p className="text-sm font-bold text-slate-900">{selectedWishPerson.fullName}</p>
                <label htmlFor={`birthday-wish-note-${selectedWishPerson.employeeId}`} className="sr-only">
                  Personal message for {selectedWishPerson.fullName} (optional)
                </label>
                <textarea
                  id={`birthday-wish-note-${selectedWishPerson.employeeId}`}
                  rows={2}
                  maxLength={500}
                  value={wishNoteByEmployee[selectedWishPerson.employeeId] ?? ""}
                  onChange={(e) =>
                    setWishNoteByEmployee((prev) => ({ ...prev, [selectedWishPerson.employeeId]: e.target.value }))
                  }
                  disabled={wishBusyId === selectedWishPerson.employeeId}
                  placeholder="Optional message (max 500 characters)…"
                  className="mt-2 min-h-[2.75rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 text-xs leading-snug text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Insert emoji into wish message">
                  {WISH_QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      disabled={wishBusyId === selectedWishPerson.employeeId}
                      title={`Insert ${em}`}
                      onClick={() => insertWishEmoji(selectedWishPerson.employeeId, em)}
                      className="grid h-8 min-w-[2rem] shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-lg leading-none transition hover:border-violet-300 hover:bg-violet-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span aria-hidden>{em}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={wishBusyId === selectedWishPerson.employeeId}
                  onClick={() => void sendWish(selectedWishPerson.employeeId)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-violet-600 bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  Send Wish
                  <span className="text-sm leading-none" aria-hidden>
                    🎂
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Expanded company notices */}
          {noticesExpanded ? (
            <div className="border-t border-slate-100 bg-slate-50/50">
              <div
                className="max-h-[min(52vh,22rem)] overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 [scrollbar-gutter:stable]"
                role="region"
                aria-label="Company notices list"
              >
                {notices.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No notices in your inbox yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">{notices.map((n) => renderNoticeRow(n))}</ul>
                )}
              </div>
              <div className="border-t border-slate-100 bg-sky-50/90 px-5 py-3 sm:px-6">
                <button
                  type="button"
                  disabled={markingAll || !hasUnreadNotices}
                  onClick={() => void markAllCompanyRead()}
                  className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-sky-800 transition hover:text-sky-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l2.5 2.5L16 9" />
                  </svg>
                  {markingAll ? "Marking…" : "Mark all as read"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6">
            <p className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
              <span className="text-base text-violet-600" aria-hidden>
                📅
              </span>
              <span>Never miss a moment that matters.</span>
            </p>
          </div>
        </>
      )}
    </section>
  );
}

export function BirthdaysCompanyNoticesWidget() {
  return (
    <Suspense
      fallback={
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-900/[0.07]">
          <div className="flex min-h-[220px] items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          </div>
        </section>
      }
    >
      <BirthdaysCompanyNoticesWidgetInner />
    </Suspense>
  );
}
