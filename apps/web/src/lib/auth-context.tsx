/**
 * AuthContext & AuthProvider.
 * Global React context holding the current user, JWT token, and auth actions
 * (login, logout, register). Persists the token in localStorage.
 */
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, getMe } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserModes(user: User): User {
  if (Array.isArray(user.availableModes) && user.availableModes.length > 0) {
    return user;
  }

  const modes: Array<'BUYER' | 'SUPPLIER' | 'CARRIER'> = [];
  const isPureTransportIndividual = !!user.canTransport && !user.canSell && !user.isCompany;

  if (user.userType === 'ADMIN' || !isPureTransportIndividual) modes.push('BUYER');
  if (user.userType === 'ADMIN' || !!user.canSell) modes.push('SUPPLIER');
  if (user.userType === 'ADMIN' || !!user.canTransport) modes.push('CARRIER');

  return {
    ...user,
    availableModes: modes.length > 0 ? modes : ['BUYER'],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('b3hub_token');
    if (storedToken) {
      getMe(storedToken)
        .then((u) => {
          setUser(normalizeUserModes(u));
          setToken(storedToken);
          // Ensure HttpOnly cookie is synced for middleware on every page load
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: storedToken }),
          }).catch(() => null);
        })
        .catch(() => {
          localStorage.removeItem('b3hub_token');
          fetch('/api/auth/session', { method: 'DELETE' }).catch(() => null);
        })
        .finally(() => setIsLoading(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }
  }, []);

  const setAuth = (user: User, token: string) => {
    setUser(normalizeUserModes(user));
    setToken(token);
    localStorage.setItem('b3hub_token', token);
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
    setUser(null);
    setToken(null);
    localStorage.removeItem('b3hub_token');
    fetch('/api/auth/session', { method: 'DELETE' }).catch(() => null);
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
