import { Stack } from 'expo-router';
import { OrderProvider } from '@/lib/order-context';
import { SCREEN } from '@/lib/transitions';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function OrderLayout() {
  return (
    <OrderProvider>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </OrderProvider>
  );
}
