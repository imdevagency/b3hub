import { Stack } from 'expo-router';
import { DisposalProvider } from '@/lib/disposal-context';
import { SCREEN } from '@/lib/transitions';

export default function DisposalLayout() {
  return (
    <DisposalProvider>
      <Stack screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </DisposalProvider>
  );
}
