import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { ToastProvider } from '@/components/ui/Toast';
import React, { useEffect, useRef } from 'react';
import { NativeModules, View } from 'react-native';
// Guard: same JSI version-mismatch issue as in App.tsx
let GestureHandlerRootView: React.ComponentType<{ style?: object; children?: React.ReactNode }> =
  View as unknown as React.ComponentType<{ style?: object; children?: React.ReactNode }>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
} catch {
  /* Expo Go fallback — plain View used instead */
}

// ── Push notifications: guarded — native module not present in Expo Go ────────
let _Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _Notifications = require('expo-notifications');
} catch {
  /* Expo Go */
}

// Show notifications as banners even when app is in foreground
try {
  _Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  /* ignore */
}

export default function RootLayout() {
  const notifListener = useRef<{ remove(): void } | null>(null);

  useEffect(() => {
    // Foreground notification received listener
    try {
      notifListener.current =
        _Notifications?.addNotificationReceivedListener(() => {
          // Badge / state updates can be wired here if needed
        }) ?? null;
    } catch {
      /* Expo Go */
    }
    return () => notifListener.current?.remove();
  }, []);

  useEffect(() => {
    // Initialise Mapbox inside a hook so a missing native module doesn't
    // crash the layout (and kill AuthProvider) before the app renders.
    // Guard with NativeModules.RNMBXModule to avoid HostFunction exceptions
    // in Expo Go where the native module is not linked.
    if (NativeModules.RNMBXModule) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const MapboxGL = require('@rnmapbox/maps').default;
        MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');
      } catch {
        // Native module present but failed to init
      }
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ModeProvider>
            <ToastProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 280,
                }}
              />
            </ToastProvider>
          </ModeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
