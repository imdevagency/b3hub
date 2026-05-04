/**
 * Support chat API — admin side.
 * Users interact via mobile; admins reply via this web dashboard.
 */
import { apiFetch } from './common';

export interface SupportMessage {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  fromAdmin: boolean;
  createdAt: string;
}

export interface SupportThread {
  id: string;
  status: 'OPEN' | 'CLOSED';
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  messages: SupportMessage[];
}

export async function adminListSupportThreads(token: string): Promise<SupportThread[]> {
  return apiFetch<SupportThread[]>('/support/admin/threads', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminGetSupportThread(
  threadId: string,
  token: string,
): Promise<SupportThread> {
  return apiFetch<SupportThread>(`/support/admin/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminReplySupportThread(
  threadId: string,
  body: string,
  token: string,
): Promise<SupportMessage> {
  return apiFetch<SupportMessage>(`/support/admin/threads/${threadId}/reply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  });
}

export async function adminSetSupportThreadStatus(
  threadId: string,
  status: 'OPEN' | 'CLOSED',
  token: string,
): Promise<SupportThread> {
  return apiFetch<SupportThread>(`/support/admin/threads/${threadId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}
