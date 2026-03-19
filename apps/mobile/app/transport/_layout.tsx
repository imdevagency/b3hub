import { Stack } from 'expo-router';
import { TransportProvider } from '@/lib/transport-context';
import { SCREEN } from '@/lib/transitions';

export default function TransportLayout() {
  return (
    <TransportProvider>
      <Stack screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </TransportProvider>
  );
}
