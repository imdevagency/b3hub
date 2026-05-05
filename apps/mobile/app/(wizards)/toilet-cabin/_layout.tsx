import { Stack } from 'expo-router';
import { SCREEN } from '@/lib/transitions';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ToiletCabinLayout() {
  return <Stack initialRouteName="index" screenOptions={{ headerShown: false, ...SCREEN.push }} />;
}
