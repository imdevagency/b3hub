import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

export default function RootLayout() {
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
