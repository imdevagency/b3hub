/**
 * Notifications API module.
 * Functions to list, mark-as-read, and delete notifications via /api/v1/notifications/*.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_DELIVERED'
  | 'TRANSPORT_ASSIGNED'
  | 'TRANSPORT_STARTED'
  | 'TRANSPORT_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'SYSTEM_ALERT';

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

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getNotifications(
  token: string,
  page = 1,
  limit = 20,
): Promise<NotificationPage> {
  return apiFetch<NotificationPage>(`/notifications?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
