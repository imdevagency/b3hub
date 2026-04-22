import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';
import type { ApiOrder, ApiDocument } from './api';

// ── Hook ──────────────────────────────────────────────────────

export function useOrderDetail(id: string | undefined) {
  const { token } = useAuth();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);

  const reload = useCallback(async (background = false) => {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    try {
      const found = await api.orders.getOne(String(id), token);
      setOrder(found ?? null);
      // Check rating status and fetch documents only for DELIVERED orders
      if (found?.status === 'DELIVERED') {
        try {
          const { reviewed } = await api.reviews.status({ orderId: id }, token);
          setAlreadyRated(reviewed);
        } catch {
          // Non-critical — leave as false
        }
        try {
          const docs = await api.documents.getByOrder(id, token);
          setDocuments(docs);
        } catch {
          // Non-critical — documents may not be generated yet
        }
      }
    } catch {
      // order stays null — screen will show empty state
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { order, setOrder, loading, alreadyRated, documents, reload };
}
