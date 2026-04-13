/**
 * Notifications API module.
 * Functions to list, mark-as-read, and delete notifications via /api/v1/notifications/*.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'ORDER_DELIVERED'
  | 'TRANSPORT_ASSIGNED'
  | 'TRANSPORT_STARTED'
  | 'TRANSPORT_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'QUOTE_RECEIVED'
  | 'QUOTE_ACCEPTED'
  | 'SYSTEM_ALERT'
  | 'DOCUMENT_EXPIRING_SOON'
  | 'WEIGHING_SLIP'
  | 'DISPOSAL_ORDER_CREATED'
  | 'DISPOSAL_ORDER_CONFIRMED'
  | 'DISPOSAL_ORDER_CANCELLED'
  | 'DISPOSAL_ORDER_COMPLETED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPage {
  data: AppNotification[];
  total: number;
  page: number;
  limit: number;
}

// Raw shape returned by the backend (field is `read`, nested under `meta`)
interface RawNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}
interface RawNotificationPage {
  data: RawNotification[];
  meta: { page: number; limit: number; total: number; unreadCount: number };
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getNotifications(
  token: string,
  page = 1,
  limit = 20,
): Promise<NotificationPage> {
  const raw = await apiFetch<RawNotificationPage>(`/notifications?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    data: raw.data.map((n) => ({ ...(n as unknown as AppNotification), isRead: n.read })),
    total: raw.meta.total,
    page: raw.meta.page,
    limit: raw.meta.limit,
  };
}

export async function getUnreadNotificationCount(
  token: string,
): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/notifications/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(
  token: string,
): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markNotificationRead(
  id: string,
  token: string,
): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}
