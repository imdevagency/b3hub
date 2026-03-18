import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
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

    /** Fetch all messages for a transport job chat. */
    getMessages: (jobId: string, token: string) =>
      apiFetch<ApiChatMessage[]>(`/chat/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Send a message in a transport job chat. */
    sendMessage: (jobId: string, body: string, token: string) =>
      apiFetch<ApiChatMessage>(`/chat/${jobId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body }),
      }),
  },
};
