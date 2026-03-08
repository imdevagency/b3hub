import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { useEffect } from 'react';

export default function RootLayout() {
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
