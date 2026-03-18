import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const notificationsApi = {
  notifications: {
    getAll: (token: string) =>
      apiFetch<ApiNotification[]>('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    unreadCount: (token: string) =>
      apiFetch<{ count: number }>('/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAllRead: (token: string) =>
      apiFetch<void>('/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    markRead: (id: string, token: string) =>
      apiFetch<void>(`/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
