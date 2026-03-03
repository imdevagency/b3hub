import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';

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
