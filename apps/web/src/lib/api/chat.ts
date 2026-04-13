/**
 * Chat API module.
 * Functions wrapping /api/v1/chat/* endpoints: list conversations,
 * fetch messages, send a message.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  body: string;
  createdAt: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getChatMessages(jobId: string, token: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendChatMessage(
  jobId: string,
  body: string,
  token: string,
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/${jobId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export async function getOrderChatMessages(orderId: string, token: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendOrderChatMessage(
  orderId: string,
  body: string,
  token: string,
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/order/${orderId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}
