"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  fetchAiConversationMessages,
  fetchAiSidekickStatus,
  fetchOpenAiSettingsStatus,
  sendAiChat,
  sendAiFeedback,
  type AiSidekickMessage,
  type AiSidekickStatus,
} from "@/components/ai-sidekick/ai-sidekick-api";
import { resolveAiPageContext } from "@/lib/ai-sidekick-context";

type AiSidekickContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  status: AiSidekickStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  messages: AiSidekickMessage[];
  conversationId: string | null;
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<boolean>;
  startNewChat: () => void;
  submitFeedback: (messageId: string, rating: 1 | -1) => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const AiSidekickContext = React.createContext<AiSidekickContextValue | null>(null);

async function loadSidekickStatus(): Promise<{ status: AiSidekickStatus | null; error: string | null }> {
  try {
    const data = await fetchAiSidekickStatus();
    return { status: data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load OpenSky AI status.";
    try {
      const openai = await fetchOpenAiSettingsStatus();
      return {
        status: {
          configured: openai.apiKeyConfigured,
          enabled: openai.enabled,
          sidekickEnabled: openai.sidekickEnabled,
          licensed: true,
          licensedModules: [],
        },
        error: null,
      };
    } catch {
      return { status: null, error: message };
    }
  }
}

export function AiSidekickProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<AiSidekickStatus | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<AiSidekickMessage[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshStatus = React.useCallback(async () => {
    setStatusLoading(true);
    const result = await loadSidekickStatus();
    setStatus(result.status);
    setStatusError(result.error);
    setStatusLoading(false);
  }, []);

  React.useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  React.useEffect(() => {
    if (open) void refreshStatus();
  }, [open, refreshStatus]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return false;

      setError(null);
      setLoading(true);

      const optimistic: AiSidekickMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        suggestedActions: [],
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const pageContext = resolveAiPageContext(pathname ?? "/app/dashboard");
        const res = await sendAiChat({
          conversationId: conversationId ?? undefined,
          message: trimmed,
          pageContext,
        });

        setConversationId(res.conversationId);

        const assistantMsg: AiSidekickMessage = {
          id: res.messageId,
          role: "assistant",
          content: res.answer,
          createdAt: new Date().toISOString(),
          suggestedActions: res.suggestedActions ?? [],
        };

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== optimistic.id);
          return [...withoutTemp, { ...optimistic, id: `user-${Date.now()}` }, assistantMsg];
        });
        return true;
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, id: `user-${Date.now()}` } : m))
        );
        setError(err instanceof Error ? err.message : "Failed to send message");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading, pathname]
  );

  const startNewChat = React.useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const submitFeedback = React.useCallback(async (messageId: string, rating: 1 | -1) => {
    await sendAiFeedback(messageId, rating);
  }, []);

  React.useEffect(() => {
    if (!conversationId || !open) return;
    void fetchAiConversationMessages(conversationId)
      .then(setMessages)
      .catch(() => {});
  }, [conversationId, open]);

  const value: AiSidekickContextValue = {
    open,
    setOpen,
    toggle: () => setOpen((v) => !v),
    status,
    statusLoading,
    statusError,
    messages,
    conversationId,
    loading,
    error,
    sendMessage,
    startNewChat,
    submitFeedback,
    refreshStatus,
  };

  return <AiSidekickContext.Provider value={value}>{children}</AiSidekickContext.Provider>;
}

export function useAiSidekick() {
  const ctx = React.useContext(AiSidekickContext);
  if (!ctx) throw new Error("useAiSidekick must be used within AiSidekickProvider");
  return ctx;
}

export function useAiSidekickOptional() {
  return React.useContext(AiSidekickContext);
}
