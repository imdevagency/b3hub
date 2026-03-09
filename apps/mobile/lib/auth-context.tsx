import React, { createContext, useContext, useEffect, useState } from 'react';
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

/** Request permission + return Expo push token string, or null if unavailable. */
async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!_Notifications || !_Device) return null; // Expo Go — native module missing
    if (!_Device.isDevice) return null;             // Simulator — skip
    const { status: existing } = await _Notifications.getPermissionsAsync();
    const finalStatus =
      existing === 'granted'
        ? existing
        : (await _Notifications.requestPermissionsAsync()).status;
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
    // Register push token with backend — fire-and-forget
    registerForPushNotifications()
      .then((pushToken) => {
        if (pushToken) api.updatePushToken(pushToken, token).catch(() => {});
      })
      .catch(() => {});
  };

  const logout = async () => {
    // Clear push token from backend before wiping session
    if (token) api.updatePushToken(null, token).catch(() => {});
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
