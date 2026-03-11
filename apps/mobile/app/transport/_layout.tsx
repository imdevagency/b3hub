import { Stack } from 'expo-router';
import { TransportProvider } from '@/lib/transport-context';

export default function TransportLayout() {
  return (
    <TransportProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TransportProvider>
  );
}
