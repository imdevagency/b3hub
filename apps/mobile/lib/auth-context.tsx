import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User } from './api';

const TOKEN_KEY = 'b3hub_token';
const USER_KEY = 'b3hub_user';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token + cached user from storage — no network call needed here.
    // isLoading resolves immediately from disk, keeping the startup spinner fast.
    Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(USER_KEY)])
      .then(([storedToken, storedUser]) => {
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as User);

          // Revalidate silently in the background so stale data self-corrects
          // without blocking the UI.
          api
            .getMe(storedToken)
            .then((freshUser) => {
              setUser(freshUser);
              AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
            })
            .catch(() => {
              // Token expired or network error — clear session
              AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
              setUser(null);
              setToken(null);
            });
        }
      })
      .catch(() => AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]))
      .finally(() => setIsLoading(false));
  }, []);

  const setAuth = async (user: User, token: string) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]);
    setUser(user);
    setToken(token);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
    setToken(null);
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
