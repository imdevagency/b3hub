/**
 * Jumis accounting integration API functions.
 * Wraps /api/v1/admin/jumis/* endpoints.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface JumisSettings {
  username: string;
  database: string;
  enabled: boolean;
  hasPassword: boolean;
}

export interface JumisSyncLogEntry {
  id: string;
  action: string;
  entityId: string;
  after: {
    pushed: number;
    success: boolean;
    error: string | null;
    since: string | null;
  } | null;
  createdAt: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
}

// ─── Settings ──────────────────────────────────────────────────────────────

export async function jumisGetSettings(token: string): Promise<JumisSettings> {
  return apiFetch('/admin/jumis/settings', { token });
}

export async function jumisUpdateSettings(
  data: { username: string; password: string; database: string; enabled: boolean },
  token: string,
): Promise<{ ok: boolean }> {
  return apiFetch('/admin/jumis/settings', {
    method: 'POST',
    body: data,
    token,
  });
}

// ─── Connection test ────────────────────────────────────────────────────────

export async function jumisTestConnection(
  token: string,
): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/admin/jumis/test', { method: 'POST', body: {}, token });
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export async function jumisSyncData(
  syncType: 'invoices' | 'partners',
  token: string,
  since?: string,
): Promise<{ ok: boolean; pushed: number; message: string }> {
  return apiFetch('/admin/jumis/sync', {
    method: 'POST',
    body: { syncType, since },
    token,
  });
}

export async function jumisGetSyncLog(token: string): Promise<JumisSyncLogEntry[]> {
  return apiFetch('/admin/jumis/sync/log', { token });
}
