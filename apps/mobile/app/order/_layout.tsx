import { Stack } from 'expo-router';
import { OrderProvider } from '@/lib/order-context';

export default function OrderLayout() {
  return (
    <OrderProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OrderProvider>
  );
}
