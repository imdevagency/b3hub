import { Stack } from 'expo-router';
import { SCREEN } from '@/lib/transitions';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...SCREEN.fade,
      }}
    />
  );
}
