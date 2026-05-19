/**
 * useBuyerOrders hook.
 * Fetches and caches the current buyer's material purchase orders.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getMyOrders,
  getMyTransportRequests,
  type ApiOrder,
  type ApiTransportJob,
} from '@/lib/api';

interface UseBuyerOrdersResult {
  matOrders: ApiOrder[];
  transportRequests: ApiTransportJob[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches material orders and buyer transport requests in parallel.
 * Used in BuyerView (orders page).
 */
export function useBuyerOrders(token: string | null): UseBuyerOrdersResult {
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [transportRequests, setTransportRequests] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [mat, transport] = await Promise.all([
        getMyOrders(token),
        getMyTransportRequests(token),
      ]);
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

  return { matOrders, transportRequests, loading, reload };
}
