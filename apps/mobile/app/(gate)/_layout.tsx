/**
 * Gate route group layout.
 * Minimal Stack — no tabs. Used only in APP_VARIANT=gate builds.
 * Auth guard: redirects to login if token is missing.
 */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { SCREEN } from '@/lib/transitions';

export default function GateLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, isLoading, router]);

  return (
    <Stack screenOptions={{ headerShown: false, ...SCREEN.push }}>
      <Stack.Screen name="fields" />
    </Stack>
  );
}
