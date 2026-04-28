import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEV_FALLBACK_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';

const RECENT_GET_TTL_MS = 1500;

type RecentGetEntry = {
  expiresAt: number;
  value: unknown;
};

const inflightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, RecentGetEntry>();

function resolveDevApiUrl(rawUrl?: string): string {
  if (!rawUrl) return DEV_FALLBACK_API_URL;
  if (Device.isDevice) return rawUrl;

  try {
    const url = new URL(rawUrl);

    if (Platform.OS === 'ios') {
      url.hostname = 'localhost';
      return url.toString().replace(/\/$/, '');
    }

    if (Platform.OS === 'android') {
      url.hostname = '10.0.2.2';
      return url.toString().replace(/\/$/, '');
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/** Base URL resolved once at module load-time. */
export const API_URL = (() => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return process.env.NODE_ENV === 'production'
      ? configuredUrl
      : resolveDevApiUrl(configuredUrl);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('EXPO_PUBLIC_API_URL must be set in production');
  }

  return DEV_FALLBACK_API_URL;
})();

function buildRequestKey(url: string, options?: RequestInit): string {
  const method = options?.method?.toUpperCase() ?? 'GET';
  const authHeader =
    options?.headers && !Array.isArray(options.headers)
      ? new Headers(options.headers).get('Authorization') ?? ''
      : '';
  return `${method}:${url}:${authHeader}`;
}

function readRecentGet<T>(key: string): T | null {
  const recent = recentGetResponses.get(key);
  if (!recent) return null;
  if (recent.expiresAt <= Date.now()) {
    recentGetResponses.delete(key);
    return null;
  }
  return recent.value as T;
}

function writeRecentGet<T>(key: string, value: T) {
  recentGetResponses.set(key, {
    value,
    expiresAt: Date.now() + RECENT_GET_TTL_MS,
  });
}

/**
 * Structured API error that preserves HTTP status and the raw response body.
 * Use `instanceof ApiError` checks to handle specific error codes from the server.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thin fetch wrapper with:
 *  - Automatic JSON serialisation / deserialisation
 *  - Configurable timeout (default 10 s)
 *  - Normalised error messages from NestJS API responses
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  timeoutMs = 20_000,
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const method = options?.method?.toUpperCase() ?? 'GET';
  const isGet = method === 'GET';
  const requestKey = buildRequestKey(url, options);

  if (!isGet) {
    inflightGetRequests.clear();
    recentGetResponses.clear();
  } else {
    const recent = readRecentGet<T>(requestKey);
    if (recent !== null) return recent;

    const inflight = inflightGetRequests.get(requestKey);
    if (inflight) return inflight as Promise<T>;
  }

  const requestPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
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
      let parsed: Record<string, unknown> = { message: 'Request failed' };
      try {
        parsed = errText ? JSON.parse(errText) : parsed;
      } catch {
        /* keep default */
      }
      const message =
        typeof parsed.message === 'string' ? parsed.message : `HTTP ${res.status}`;
      console.log("API_ERR", res.status, message, url); throw new ApiError(res.status, message, parsed);
    }

    // Handle empty body (e.g. 204 No Content)
    const text = await res.text();
    const parsed = text.length > 0 ? (JSON.parse(text) as T) : (null as T);

    if (isGet) {
      writeRecentGet(requestKey, parsed);
    }

    return parsed;
  })();

  if (!isGet) {
    return requestPromise;
  }

  inflightGetRequests.set(requestKey, requestPromise as Promise<unknown>);

  try {
    return await requestPromise;
  } finally {
    inflightGetRequests.delete(requestKey);
  }
}
