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
      router.replace(MODE_HOME[mode] as any);
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading, mode]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#dc2626" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
