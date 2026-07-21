import { apiFetch } from "@/lib/api";
import type { AiPageContext } from "@/lib/ai-sidekick-context";

export type AiSidekickStatus = {
  configured: boolean;
  enabled: boolean;
  sidekickEnabled: boolean;
  licensed?: boolean;
  licensedModules: string[];
};

export type AiSidekickMessage = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  createdAt: string;
  suggestedActions: string[];
};

export type AiChatResponse = {
  conversationId: string;
  messageId: string;
  answer: string;
  suggestedActions: string[];
};

export function fetchAiSidekickStatus() {
  return apiFetch<AiSidekickStatus>("/api/ai-assistant/status");
}

export function fetchOpenAiSettingsStatus() {
  return apiFetch<{
    enabled: boolean;
    sidekickEnabled: boolean;
    apiKeyConfigured: boolean;
  }>("/api/system-settings/openai");
}

export function fetchAiConversationMessages(conversationId: string) {
  return apiFetch<AiSidekickMessage[]>(`/api/ai-assistant/conversations/${conversationId}/messages`);
}

export function sendAiChat(payload: {
  conversationId?: string;
  message: string;
  pageContext: AiPageContext;
}) {
  return apiFetch<AiChatResponse>("/api/ai-assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendAiFeedback(messageId: string, rating: 1 | -1) {
  return apiFetch<{ saved: boolean }>(`/api/ai-assistant/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export function deleteAiConversation(conversationId: string) {
  return apiFetch<void>(`/api/ai-assistant/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export type AiPrivacyNotice = {
  notice: string;
  provider: string;
  region?: string;
  chatRetentionDays: number;
  auditRetentionDays: number;
  allowPersonalNamesInLlm: boolean;
};

export function fetchAiPrivacyNotice() {
  return apiFetch<AiPrivacyNotice>("/api/ai-assistant/privacy");
}

export function exportAiMyData() {
  return apiFetch<unknown>("/api/ai-assistant/my-data/export");
}

export function deleteAiMyData() {
  return apiFetch<void>("/api/ai-assistant/my-data", { method: "DELETE" });
}
