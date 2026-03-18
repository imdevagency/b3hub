/**
 * Common API helpers.
 * Shared request utilities — error normalisation, pagination helpers, etc.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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
