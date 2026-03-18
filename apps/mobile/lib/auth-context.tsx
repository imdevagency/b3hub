import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api, User } from './api';

// ── Push notifications: guarded dynamic require ───────────────────────────────
// expo-notifications requires a custom dev build (native module 'ExpoPushTokenManager').
// When running in Expo Go the require will throw — catch it and disable push
// silently so the rest of the app continues to work.
let _Notifications: typeof import('expo-notifications') | null = null;
let _Device: typeof import('expo-device') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _Device = require('expo-device');
} catch {
  // Expo Go — push notifications unavailable
}

const TOKEN_KEY = 'b3hub_token';
const USER_KEY = 'b3hub_user';
const REFRESH_TOKEN_KEY = 'b3hub_refresh_token';

/**
 * Decode a JWT payload without verifying the signature (client-side only).
 * Returns the exp field in milliseconds, or Infinity if not present.
 */
function jwtExpiryMs(token: string): number {
  try {
    const [, payloadB64] = token.split('.');
    const json = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : Infinity;
  } catch {
    return Infinity;
  }
}

/** Returns true if the JWT will expire within the next 5 minutes. */
function tokenExpiringOrExpired(token: string): boolean {
  return jwtExpiryMs(token) < Date.now() + 5 * 60 * 1000;
}

/** Request permission + return Expo push token string, or null if unavailable. */
async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!_Notifications || !_Device) return null; // Expo Go — native module missing
    if (!_Device.isDevice) return null; // Simulator — skip
    const { status: existing } = await _Notifications.getPermissionsAsync();
    const finalStatus =
      existing === 'granted' ? existing : (await _Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await _Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: _Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { data } = await _Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null; // Any native error — degrade silently
  }
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, refreshToken: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const defaultAuthContext: AuthContextValue = {
  user: null,
  token: null,
  setAuth: async () => {},
  updateUser: async () => {},
  logout: async () => {},
  isLoading: true,
};

const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persist and set a new access + refresh token pair, then schedule proactive refresh. */
  const applyTokens = async (newToken: string, newRefreshToken: string) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, newToken],
      [REFRESH_TOKEN_KEY, newRefreshToken],
    ]);
    setToken(newToken);
    scheduleRefresh(newToken, newRefreshToken);
  };

  /** Schedule a token refresh ~1 minute before expiry. */
  const scheduleRefresh = (currentToken: string, currentRefreshToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiryMs = jwtExpiryMs(currentToken);
    if (expiryMs === Infinity) return; // non-expiring token — skip
    const delay = Math.max(0, expiryMs - Date.now() - 60 * 1000); // 1 min before expiry
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.refreshToken(currentRefreshToken);
        await applyTokens(res.token, res.refreshToken);
      } catch {
        // Refresh token also expired — clear session
        await clearSession();
      }
    }, delay);
  };

  const clearSession = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, REFRESH_TOKEN_KEY]);
    setUser(null);
    setToken(null);
  };

  useEffect(() => {
    // Load token + cached user from storage — no network call needed here.
    // isLoading resolves immediately from disk, keeping the startup spinner fast.
    Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(REFRESH_TOKEN_KEY),
    ])
      .then(async ([storedToken, storedUser, storedRefreshToken]) => {
        if (!storedToken || !storedUser) return;

        let activeToken = storedToken;

        // Proactively refresh if the access token is expiring or already expired
        if (tokenExpiringOrExpired(storedToken) && storedRefreshToken) {
          try {
            const res = await api.refreshToken(storedRefreshToken);
            activeToken = res.token;
            await AsyncStorage.multiSet([
              [TOKEN_KEY, res.token],
              [REFRESH_TOKEN_KEY, res.refreshToken],
            ]);
          } catch {
            // Refresh token also expired — force login
            await clearSession();
            return;
          }
        }

        setToken(activeToken);
        setUser(JSON.parse(storedUser) as User);
        if (storedRefreshToken) scheduleRefresh(activeToken, storedRefreshToken);

        // Revalidate silently in background so stale data self-corrects
        api
          .getMe(activeToken)
          .then((freshUser) => {
            setUser(freshUser);
            AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          })
          .catch((err: unknown) => {
            // Only clear session on genuine auth failure (401/Unauthorized).
            // Transient network errors, timeouts, etc. keep the stale session alive.
            const msg: string = err instanceof Error ? err.message : '';
            if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
              clearSession();
            }
          });
      })
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAuth = async (user: User, token: string, refreshToken: string) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
    setUser(user);
    setToken(token);
    scheduleRefresh(token, refreshToken);
    // Register push token with backend — fire-and-forget
    registerForPushNotifications()
      .then((pushToken) => {
        if (pushToken) api.updatePushToken(pushToken, token).catch(() => {});
      })
      .catch(() => {});
  };

  const logout = async () => {
    // Clear push token and revoke refresh token on server, then wipe local session
    if (token) {
      api.updatePushToken(null, token).catch(() => {});
      api.logoutServer(token).catch(() => {});
    }
    await clearSession();
  };

  /** Update only the cached user object (e.g. after a profile edit). Tokens unchanged. */
  const updateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, updateUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
