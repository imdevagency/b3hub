/**
 * AuthContext & AuthProvider.
 * Global React context holding the current user, JWT token, and auth actions
 * (login, logout, register). Persists the token in localStorage.
 *
 * Session management:
 * - Access token (JWT): 15-minute expiry, stored in localStorage as b3hub_token
 * - Refresh token: 90-day rolling window, stored as b3hub_refresh_token
 * - On any 401, apiFetch calls the registered refresh handler, which exchanges
 *   the refresh token for a new pair and retries the original request.
 * - If refresh fails, the session is cleared and the user is sent to /login.
 */
'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { User, getMe } from '@/lib/api';
import { refreshTokens } from '@/lib/api/auth';
import { registerRefreshHandler } from '@/lib/api/common';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'b3hub_token';
const REFRESH_KEY = 'b3hub_refresh_token';

function normalizeUserModes(user: User): User {
  // Admins have no buyer/supplier/carrier roles — they operate exclusively in the admin panel.
  // This check must run BEFORE the early-return so backend-supplied modes are overridden.
  if (user.userType === 'ADMIN') {
    return { ...user, availableModes: [] };
  }

  if (Array.isArray(user.availableModes) && user.availableModes.length > 0) {
    return user;
  }

  const modes: Array<'BUYER' | 'SUPPLIER' | 'CARRIER'> = [];
  const isPureTransportIndividual = !!user.canTransport && !user.canSell && !user.isCompany;

  if (!isPureTransportIndividual) modes.push('BUYER');
  if (!!user.canSell) modes.push('SUPPLIER');
  if (!!user.canTransport) modes.push('CARRIER');

  return {
    ...user,
    availableModes: modes.length > 0 ? modes : ['BUYER'],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  // Keep a ref so the refresh handler closure always reads the latest token
  const tokenRef = useRef<string | null>(null);

  // Register the 401 refresh handler once on mount so apiFetch can use it
  useEffect(() => {
    registerRefreshHandler(async (): Promise<string | null> => {
      const storedRefresh = localStorage.getItem(REFRESH_KEY);
      if (!storedRefresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const result = await refreshTokens(storedRefresh);
        // Persist new token pair
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(REFRESH_KEY, result.refreshToken);
        tokenRef.current = result.token;
        setToken(result.token);
        // Sync cookie for middleware
        fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: result.token }),
        }).catch(() => null);
        return result.token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearSession() {
    setUser(null);
    setToken(null);
    tokenRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    fetch('/api/auth/session', { method: 'DELETE' }).catch(() => null);
  }

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      getMe(storedToken)
        .then((u) => {
          setUser(normalizeUserModes(u));
          setToken(storedToken);
          tokenRef.current = storedToken;
          // Ensure HttpOnly cookie is synced for middleware on every page load
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: storedToken }),
          }).catch(() => null);
        })
        .catch(() => {
          // getMe returned 401 — refresh handler will have already tried or failed
          // Only remove if still the same token (not already replaced by refresh)
          if (localStorage.getItem(TOKEN_KEY) === storedToken) {
            clearSession();
          }
          if (pathname.startsWith('/dashboard')) {
            router.replace('/login');
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAuth = (user: User, token: string, refreshToken?: string) => {
    setUser(normalizeUserModes(user));
    setToken(token);
    tokenRef.current = token;
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
    }
    // Set HttpOnly cookie via server route so middleware can gate dashboard routes
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);

    // Some endpoints return a lightweight user object. Refresh full profile for
    // consistent role-mode switching state.
    getMe(token)
      .then((u) => setUser(normalizeUserModes(u)))
      .catch(() => null);
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
