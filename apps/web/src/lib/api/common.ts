/**
 * Common API helpers.
 * Shared request utilities — error normalisation, pagination helpers, etc.
 *
 * 401 interceptor: when an access token expires, apiFetch automatically tries
 * to refresh it via the registered handler. On success it retries the original
 * request once. If refresh also fails, the handler clears the session and
 * redirects to /login.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// ─── Refresh handler (set by AuthProvider on mount) ───────────────────────

/** Registered by AuthProvider. Returns a new access token, or null if refresh failed. */
let _refreshHandler: (() => Promise<string | null>) | null = null;
/** Dedup: reuse an in-flight refresh promise rather than firing multiple requests. */
let _refreshPromise: Promise<string | null> | null = null;

export function registerRefreshHandler(fn: () => Promise<string | null>) {
  _refreshHandler = fn;
}

async function attemptRefresh(): Promise<string | null> {
  if (!_refreshHandler) return null;
  if (!_refreshPromise) {
    _refreshPromise = _refreshHandler().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

// ─── Core fetch helper ─────────────────────────────────────────────────────

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // On 401: try to silently refresh, then retry once
  if (res.status === 401) {
    const newToken = await attemptRefresh();
    if (newToken) {
      // Rebuild headers with new token
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${newToken}`,
      };
      const retryRes = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: retryHeaders,
      });
      if (retryRes.ok) {
        const text = await retryRes.text();
        return (text ? JSON.parse(text) : {}) as T;
      }
      // Retry also 401 — session truly expired
      if (retryRes.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired');
      }
      const text = await retryRes.text().catch(() => '');
      let error: { message?: string } = { message: 'Request failed' };
      try { error = text ? JSON.parse(text) : error; } catch { /* keep default */ }
      throw new Error(error.message || `HTTP ${retryRes.status}`);
    } else {
      // No refresh handler or refresh failed — redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let error: { message?: string } = { message: 'Request failed' };
    try {
      error = text ? JSON.parse(text) : error;
    } catch {
      /* keep default */
    }
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}
