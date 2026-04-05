import { Stack } from 'expo-router';
import { TransportProvider } from '@/lib/transport-context';
import { SCREEN } from '@/lib/transitions';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TransportLayout() {
  return (
    <TransportProvider>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </TransportProvider>
  );
}
