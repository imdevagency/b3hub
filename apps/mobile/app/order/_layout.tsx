import { Stack } from 'expo-router';
import { OrderProvider } from '@/lib/order-context';
import { SCREEN } from '@/lib/transitions';

export default function OrderLayout() {
  return (
    <OrderProvider>
      <Stack screenOptions={{ headerShown: false, ...SCREEN.push }} />
    </OrderProvider>
  );
}
