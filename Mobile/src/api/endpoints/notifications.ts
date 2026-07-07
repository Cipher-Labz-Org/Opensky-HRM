import { apiFetch } from "@/api/client";
import type { NotificationInbox, UnreadCountResponse } from "@/types/notifications";

export async function getNotifications(take = 30): Promise<NotificationInbox> {
  return apiFetch<NotificationInbox>(`/api/notifications?take=${take}`);
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return apiFetch<UnreadCountResponse>("/api/notifications/unread-count");
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch<void>(`/api/notifications/${id}/read`, { method: "POST" });
}
