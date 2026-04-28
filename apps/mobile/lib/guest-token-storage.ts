/**
 * Persists guest order tokens to AsyncStorage so that:
 * 1. Guest orders remain visible in the "Aktivitāte" tab after the wizard closes.
 * 2. After the guest creates an account, we can surface the order until it is
 *    handled by the team (no automatic backend conversion yet).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ORDERS_KEY = '@b3hub_guest_orders';
const MAX_STORED = 10; // keep only the 10 most-recent guest orders

export interface StoredGuestOrder {
  token: string;
  orderNumber: string;
  category: string; // 'MATERIAL' | 'SKIP_HIRE' | 'TRANSPORT' | 'DISPOSAL'
  createdAt: number; // Unix ms
}

export async function addGuestOrder(order: StoredGuestOrder): Promise<void> {
  try {
    const existing = await getStoredGuestOrders();
    // Deduplicate by token; keep newest at the front
    const updated = [order, ...existing.filter((o) => o.token !== order.token)].slice(
      0,
      MAX_STORED,
    );
    await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated));
  } catch {
    // Non-fatal: silently ignore storage errors
  }
}

export async function getStoredGuestOrders(): Promise<StoredGuestOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_ORDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredGuestOrder[];
  } catch {
    return [];
  }
}

export async function removeGuestOrder(token: string): Promise<void> {
  try {
    const existing = await getStoredGuestOrders();
    const updated = existing.filter((o) => o.token !== token);
    await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated));
  } catch {
    // Non-fatal
  }
}
