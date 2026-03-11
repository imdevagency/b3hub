import { Stack } from 'expo-router';
import { DisposalProvider } from '@/lib/disposal-context';

export default function DisposalLayout() {
  return (
    <DisposalProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DisposalProvider>
  );
}
