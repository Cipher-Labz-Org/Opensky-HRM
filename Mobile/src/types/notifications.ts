export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt: string | null;
  sourceUserId: string | null;
}

export interface NotificationInbox {
  items: NotificationItem[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
