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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('b3hub_token');
    if (storedToken) {
      getMe(storedToken)
        .then((u) => {
          setUser(u);
          setToken(storedToken);
          // Ensure cookie is synced for middleware on every page load
          document.cookie = `b3hub_token=${storedToken}; path=/; max-age=604800; samesite=lax`;
        })
        .catch(() => {
          localStorage.removeItem('b3hub_token');
          document.cookie = 'b3hub_token=; path=/; max-age=0';
        })
        .finally(() => setIsLoading(false));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }
  }, []);

  const setAuth = (user: User, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem('b3hub_token', token);
    // Mirror to a cookie so Next.js middleware can gate dashboard routes
    document.cookie = `b3hub_token=${token}; path=/; max-age=604800; samesite=lax`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('b3hub_token');
    document.cookie = 'b3hub_token=; path=/; max-age=0';
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
