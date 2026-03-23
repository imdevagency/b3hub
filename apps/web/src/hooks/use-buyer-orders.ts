/**
 * useBuyerOrders hook.
 * Fetches and caches the current buyer's material purchase orders.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getMySkipHireOrders,
  getMyOrders,
  getMyTransportRequests,
  type SkipHireOrder,
  type ApiOrder,
  type ApiTransportJob,
} from '@/lib/api';

interface UseBuyerOrdersResult {
  skipOrders: SkipHireOrder[];
  matOrders: ApiOrder[];
  transportRequests: ApiTransportJob[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches skip-hire orders, material orders, and buyer transport requests in parallel.
 * Used in BuyerView (orders page).
 */
export function useBuyerOrders(token: string | null): UseBuyerOrdersResult {
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [transportRequests, setTransportRequests] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [skip, mat, transport] = await Promise.all([
        getMySkipHireOrders(token),
        getMyOrders(token),
        getMyTransportRequests(token),
      ]);
      setSkipOrders(skip);
      setMatOrders(mat);
      setTransportRequests(transport);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { skipOrders, matOrders, transportRequests, loading, reload };
}
