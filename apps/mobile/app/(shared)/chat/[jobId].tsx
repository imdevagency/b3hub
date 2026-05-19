/**
 * Chat route — redirects to Bilt Support.
 *
 * Direct peer-to-peer chat between buyers, drivers, and sellers is not
 * supported. All contact goes through Bilt (Schüttflix "Smooth Contacts"
 * model). Any deep link that previously opened this P2P chat now opens
 * the Bilt support thread instead.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/lib/theme';

export default function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(shared)/support-chat' as any);
  }, [router]);

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
