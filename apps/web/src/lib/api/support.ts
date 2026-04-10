/**
 * Support chat API — admin side.
 * Users interact via mobile; admins reply via this web dashboard.
 */
import { API_URL } from './common';

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
  const res = await fetch(`${API_URL}/support/admin/threads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load support threads');
  return res.json();
}

export async function adminGetSupportThread(
  threadId: string,
  token: string,
): Promise<SupportThread> {
  const res = await fetch(`${API_URL}/support/admin/threads/${threadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load support thread');
  return res.json();
}

export async function adminReplySupportThread(
  threadId: string,
  body: string,
  token: string,
): Promise<SupportMessage> {
  const res = await fetch(`${API_URL}/support/admin/threads/${threadId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error('Failed to send reply');
  return res.json();
}

export async function adminSetSupportThreadStatus(
  threadId: string,
  status: 'OPEN' | 'CLOSED',
  token: string,
): Promise<SupportThread> {
  const res = await fetch(`${API_URL}/support/admin/threads/${threadId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update thread status');
  return res.json();
}
