import { useCallback, useEffect, useState } from 'react';
import { getMySkipHireOrders, getMyOrders, type SkipHireOrder, type ApiOrder } from '@/lib/api';

interface UseBuyerOrdersResult {
  skipOrders: SkipHireOrder[];
  matOrders: ApiOrder[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches skip-hire orders and material orders for a buyer in one parallel call.
 * Used in BuyerView (orders page).
 */
export function useBuyerOrders(token: string | null): UseBuyerOrdersResult {
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [skip, mat] = await Promise.all([getMySkipHireOrders(token), getMyOrders(token)]);
      setSkipOrders(skip);
      setMatOrders(mat);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { skipOrders, matOrders, loading, reload };
}
