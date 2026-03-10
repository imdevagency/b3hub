import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode, MODE_HOME } from '@/lib/mode-context';

export default function Index() {
  const { user, isLoading } = useAuth();
  const { mode } = useMode();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      // Small timeout so any pending mode state update from ModeSwitcher
      // has committed before we read it here.
      const t = setTimeout(() => {
        router.replace(MODE_HOME[mode] as any);
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
