import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

// Show notifications as banners even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const notifListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Foreground notification received listener
    notifListener.current = Notifications.addNotificationReceivedListener(() => {
      // Badge / state updates can be wired here if needed
    });
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
    <SafeAreaProvider>
      <AuthProvider>
        <ModeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ModeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
