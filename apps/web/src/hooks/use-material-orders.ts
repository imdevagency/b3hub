/**
 * useMaterialOrders hook.
 * Fetches material orders for the supplier view (incoming orders to fulfil).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getMyOrders, type ApiOrder } from '@/lib/api';

interface UseMaterialOrdersResult {
  orders: ApiOrder[];
  loading: boolean;
  setOrders: React.Dispatch<React.SetStateAction<ApiOrder[]>>;
  reload: () => Promise<void>;
}

/**
 * Fetches all material orders for the authenticated user.
 * Exposes setOrders so callers can apply optimistic updates (confirm/cancel).
 * Used in SupplierView (orders page).
 */
export function useMaterialOrders(token: string | null): UseMaterialOrdersResult {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyOrders(token);
      setOrders(data);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { orders, loading, setOrders, reload };
}
