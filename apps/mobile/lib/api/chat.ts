import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiSupportMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
}

export interface ApiSupportThread {
  id: string;
  status: string;
  messages: ApiSupportMessage[];
}

export interface ApiSupportMessagesResult {
  threadId: string | null;
  status: string;
  messages: ApiSupportMessage[];
}

export interface ApiChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
}

export interface ApiChatRoom {
  jobId: string;
  jobNumber: string;
  jobType: string;
  cargoType: string | null;
  pickupCity: string | null;
  deliveryCity: string | null;
  status: string;
  otherParticipantId: string | null;
  otherParticipantName: string | null;
  lastMessage: { body: string; senderName: string; createdAt: string } | null;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const chatApi = {
  chat: {
    /** List all chat rooms the current user participates in. */
    myRooms: (token: string) =>
      apiFetch<ApiChatRoom[]>('/chat/my-rooms', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Count unread messages across all chat rooms. */
    unreadCount: (token: string) =>
      apiFetch<{ count: number }>('/chat/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Fetch all messages for a transport job chat. */
    getMessages: (jobId: string, token: string) =>
      apiFetch<ApiChatMessage[]>(`/chat/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Send a message in a transport job chat. */
    sendMessage: (jobId: string, body: string, token: string, imageUrl?: string) =>
      apiFetch<ApiChatMessage>(`/chat/${jobId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body, ...(imageUrl ? { imageUrl } : {}) }),
      }),

    /** Upload a photo and get back a Supabase Storage URL. */
    uploadImage: (jobId: string, base64: string, mimeType: string, token: string) =>
      apiFetch<{ imageUrl: string }>(`/chat/${jobId}/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, mimeType }),
      }),
  },

  support: {
    /** Get (or auto-create) the user's support thread with messages. */
    getOrCreate: (token: string) =>
      apiFetch<ApiSupportThread>('/support/my-thread', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Fetch messages for the user's support thread. */
    getMessages: (token: string) =>
      apiFetch<ApiSupportMessagesResult>('/support/my-messages', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Send a message on the user's support thread. */
    sendMessage: (body: string, token: string) =>
      apiFetch<ApiSupportMessage>('/support/my-messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
  },
};
