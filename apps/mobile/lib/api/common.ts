/** Base URL resolved once at module load-time. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EXPO_PUBLIC_API_URL must be set in production');
  }
  return 'http://localhost:3000/api/v1';
})();

/**
 * Thin fetch wrapper with:
 *  - Automatic JSON serialisation / deserialisation
 *  - Configurable timeout (default 10 s)
 *  - Normalised error messages from NestJS API responses
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let error: { message?: string } = { message: 'Request failed' };
    try {
      error = errText ? JSON.parse(errText) : error;
    } catch {
      /* keep default */
    }
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  // Handle empty body (e.g. 204 No Content)
  const text = await res.text();
  return text.length > 0 ? (JSON.parse(text) as T) : (null as T);
}
