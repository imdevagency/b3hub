/**
 * Mobile home / splash screen.
 * Shows the B3Hub logo and routes authenticated users to the dashboard
 * or unauthenticated users to the login screen.
 *
 * Gate variant (APP_VARIANT=gate): bypasses buyer/driver/seller tabs and
 * routes directly to the gate-scan screen. No onboarding flow.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';
import { useMode, MODE_HOME } from '@/lib/mode-context';
import { ONBOARDING_KEY } from './(auth)/onboarding';

const IS_GATE_APP = process.env.APP_VARIANT === 'gate';

export default function Index() {
  const { user, isLoading } = useAuth();
  const { mode } = useMode();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (IS_GATE_APP) {
      // Gate build: login → field picker → gate-scan only. No onboarding, no role tabs.
      if (user) {
        router.replace('/(gate)/fields');
      } else {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (user) {
      const t = setTimeout(async () => {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!seen) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace(MODE_HOME[mode]);
        }
      }, 50);
      return () => clearTimeout(t);
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading, mode]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#111827" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
