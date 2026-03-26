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

interface RawNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  isRead?: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: RawNotification[];
  meta: { page: number; limit: number; total: number; unreadCount: number };
}

function normalize(n: RawNotification): ApiNotification {
  return {
    ...n,
    // Backend uses `read`, mobile components expect `isRead`
    isRead: n.isRead ?? n.read,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────

export const notificationsApi = {
  notifications: {
    getAll: async (token: string): Promise<ApiNotification[]> => {
      const res = await apiFetch<NotificationsResponse | RawNotification[]>('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw: RawNotification[] = Array.isArray(res) ? res : (res?.data ?? []);
      return raw.map(normalize);
    },

    unreadCount: (token: string) =>
      apiFetch<{ count: number }>('/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAllRead: (token: string) =>
      apiFetch<void>('/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),

    markRead: (id: string, token: string) =>
      apiFetch<void>(`/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
