import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { ToastProvider } from '@/components/ui/Toast';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const MapboxGL = require('@rnmapbox/maps').default;
      MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');
    } catch {
      // Native module not available (e.g. Expo Go) — map screens will show
      // their own error; auth and navigation are unaffected.
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
