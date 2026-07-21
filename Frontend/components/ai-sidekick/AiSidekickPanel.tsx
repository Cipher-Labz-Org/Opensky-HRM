"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAiSidekick, useAiSidekickOptional } from "@/components/ai-sidekick/AiSidekickProvider";
import { AI_SIDEKICK_STARTER_PROMPTS, resolveAiPageContext } from "@/lib/ai-sidekick-context";
import {
  deleteAiMyData,
  fetchAiPrivacyNotice,
  type AiPrivacyNotice,
} from "@/components/ai-sidekick/ai-sidekick-api";
import { AiMessageContent } from "@/components/ai-sidekick/AiMessageContent";
import { ROUTES } from "@/config/routes";
import { OPENSKY_THEME } from "@/lib/opensky-theme";

const T = OPENSKY_THEME;
const PRIVACY_ACK_KEY = "opensky_ai_privacy_ack_v1";

function AiSparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.455 2.456Z"
      />
    </svg>
  );
}

export function AiSidekickPanel() {
  const pathname = usePathname();
  const {
    open,
    setOpen,
    status,
    statusLoading,
    statusError,
    messages,
    loading,
    error,
    sendMessage,
    startNewChat,
    submitFeedback,
    refreshStatus,
  } = useAiSidekick();

  const [input, setInput] = React.useState("");
  const [feedback, setFeedback] = React.useState<Record<string, 1 | -1>>({});
  const [privacyAcked, setPrivacyAcked] = React.useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = React.useState(false);
  const [privacyNotice, setPrivacyNotice] = React.useState<AiPrivacyNotice | null>(null);
  const [privacyChecked, setPrivacyChecked] = React.useState(false);
  const [deletingHistory, setDeletingHistory] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const pageContext = resolveAiPageContext(pathname ?? "/app/dashboard");

  const sidekickReady =
    !!status?.configured &&
    !!status?.sidekickEnabled &&
    status?.licensed !== false;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setPrivacyAcked(localStorage.getItem(PRIVACY_ACK_KEY) === "1");
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void fetchAiPrivacyNotice()
      .then(setPrivacyNotice)
      .catch(() => setPrivacyNotice(null));
  }, [open]);

  React.useEffect(() => {
    if (open && sidekickReady && !privacyAcked) {
      setShowPrivacyModal(true);
    }
  }, [open, sidekickReady, privacyAcked]);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading, open]);

  if (!open) return null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  function unavailableMessage() {
    if (statusError) return statusError;
    if (status?.licensed === false) {
      return "The OpenSky AI module is not licensed for your organization. Contact your administrator.";
    }
    if (!status?.configured) {
      return "An OpenAI API key is required. Add or re-save your key under Policy & Settings → OpenAI, and ensure “Enable OpenSky AI” is checked.";
    }
    if (!status?.sidekickEnabled) {
      return "Turn on “Enable OpenSky AI” under Policy & Settings → OpenAI.";
    }
    return "OpenSky AI is not available right now.";
  }

  async function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || loading || !privacyAcked) return;
    const fromInput = text == null;
    if (fromInput) setInput("");
    const ok = await sendMessage(value);
    if (!ok && fromInput) setInput(value);
  }

  function acceptPrivacy() {
    if (!privacyChecked) return;
    localStorage.setItem(PRIVACY_ACK_KEY, "1");
    setPrivacyAcked(true);
    setShowPrivacyModal(false);
  }

  async function handleDeleteHistory() {
    if (!confirm("Delete all your OpenSky AI chat history? This cannot be undone.")) return;
    setDeletingHistory(true);
    try {
      await deleteAiMyData();
      startNewChat();
    } catch {
      /* provider shows error */
    } finally {
      setDeletingHistory(false);
    }
  }

  return (
    <>
      {showPrivacyModal ? (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">OpenSky AI — Privacy</h3>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
              {privacyNotice?.notice ??
                "OpenSky AI sends your questions and summarized HR tool results to an external language model. Chat history is stored for a limited time."}
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">I understand how OpenSky AI uses my data</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!privacyChecked}
                onClick={acceptPrivacy}
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="fixed inset-0 top-[60px] z-[44] bg-slate-900/10 lg:hidden"
        aria-label="Close OpenSky AI"
        onClick={() => setOpen(false)}
      />
      <aside
        className="fixed bottom-0 right-0 top-[60px] z-[46] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]"
        aria-label="OpenSky AI"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <AiSparklesIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">OpenSky AI</p>
              <p className="text-[11px] text-slate-500">{pageContext.moduleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="New chat"
              onClick={startNewChat}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              type="button"
              title="Close"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {statusLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading OpenSky AI…</p>
          ) : !sidekickReady ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
              <p className="font-medium">OpenSky AI is not available</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">{unavailableMessage()}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={ROUTES.settings}
                  className="text-xs font-semibold underline"
                  style={{ color: T.action }}
                >
                  Open Settings
                </Link>
                <button
                  type="button"
                  onClick={() => void refreshStatus()}
                  className="text-xs font-semibold text-slate-600 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Ask about headcount, leave, attendance, approvals, and more. I use live HR data within your access
                scope.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Try asking</p>
                {AI_SIDEKICK_STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSend(prompt)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-[var(--action)]/40 hover:bg-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${
                      m.role === "user"
                        ? "bg-[var(--action)] text-white"
                        : "border border-slate-100 bg-slate-50 text-slate-800"
                    }`}
                  >
                    {m.role === "user" ? (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    ) : (
                      <AiMessageContent content={m.content} />
                    )}
                    {m.role === "assistant" && !m.id.startsWith("temp") ? (
                      <div className="mt-2 flex items-center gap-2 border-t border-slate-200/80 pt-2">
                        <button
                          type="button"
                          title="Copy"
                          className="text-slate-400 hover:text-slate-600"
                          onClick={() => void navigator.clipboard.writeText(m.content)}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Helpful"
                          className={feedback[m.id] === 1 ? "text-green-600" : "text-slate-400 hover:text-slate-600"}
                          onClick={() => {
                            setFeedback((f) => ({ ...f, [m.id]: 1 }));
                            void submitFeedback(m.id, 1);
                          }}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.278 2.107-.756l.645-.645A2.25 2.25 0 0110.5 7.5h4.125a2.25 2.25 0 012.012 3.465l-1.098 2.195M6.633 10.25H4.125A2.25 2.25 0 002.25 12v6.75A2.25 2.25 0 004.5 21h12.75M6.633 10.25l1.732-3.465M18 18.75a2.25 2.25 0 01-2.25 2.25H9.75A2.25 2.25 0 017.5 18.75V9.75" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Not helpful"
                          className={feedback[m.id] === -1 ? "text-red-600" : "text-slate-400 hover:text-slate-600"}
                          onClick={() => {
                            setFeedback((f) => ({ ...f, [m.id]: -1 }));
                            void submitFeedback(m.id, -1);
                          }}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372A2.25 2.25 0 012.25 13V6.25A2.25 2.25 0 014.5 4.125h4.125a2.25 2.25 0 012.012 1.098l1.098 2.195M7.498 15.25l-1.732 3.465M16.502 5.25H19.63A2.25 2.25 0 0121.75 7.5v6.75a2.25 2.25 0 01-2.25 2.25H15.38a2.25 2.25 0 01-2.012-1.098l-1.098-2.195M16.502 5.25l1.732-3.465" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {lastAssistant && lastAssistant.suggestedActions.length > 0 ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">Would you like me to:</p>
                  <ul className="mt-2 space-y-1.5">
                    {lastAssistant.suggestedActions.map((action) => (
                      <li key={action}>
                        <button
                          type="button"
                          onClick={() => void handleSend(action)}
                          className="text-left text-sm text-[var(--action)] hover:underline"
                        >
                          • {action}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                  Thinking…
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 9.75V21m16.5-11.25V21M6 21V9.75A2.25 2.25 0 018.25 7.5h7.5A2.25 2.25 0 0118 9.75V21M6 21h12" />
                </svg>
                {pageContext.moduleLabel}
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={3}
              disabled={!sidekickReady || loading || !privacyAcked}
              placeholder="Message OpenSky AI…"
              className="w-full resize-none border-0 bg-transparent px-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50"
            />
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                disabled={!sidekickReady || loading || !input.trim() || !privacyAcked}
                onClick={() => void handleSend()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition disabled:opacity-40"
                style={{ backgroundColor: T.action }}
                aria-label="Send message"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
            <span>AI may be inaccurate — review answers before acting on HR data.</span>
            <button
              type="button"
              className="underline hover:text-slate-600"
              onClick={() => setShowPrivacyModal(true)}
            >
              How OpenSky AI uses data
            </button>
            <button
              type="button"
              className="underline hover:text-slate-600 disabled:opacity-50"
              disabled={deletingHistory}
              onClick={() => void handleDeleteHistory()}
            >
              {deletingHistory ? "Deleting…" : "Delete my AI history"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function AiSidekickIconButton({ iconBtnClass }: { iconBtnClass: string }) {
  const sidekick = useAiSidekickOptional();
  if (!sidekick) return null;

  return (
    <button
      type="button"
      className={`${iconBtnClass} ${sidekick.open ? "bg-violet-50 text-violet-600" : "text-violet-600"}`}
      title="OpenSky AI"
      aria-label="OpenSky AI"
      aria-pressed={sidekick.open}
      onClick={sidekick.toggle}
    >
      <AiSparklesIcon className="h-[18px] w-[18px]" />
    </button>
  );
}
