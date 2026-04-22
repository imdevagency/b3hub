import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';
import type { SkipHireOrder } from './api';

// ── Hook ──────────────────────────────────────────────────────

export function useSkipOrder(id: string | undefined) {
  const { token } = useAuth();
  const [order, setOrder] = useState<SkipHireOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback((background = false) => {
    if (!id || !token) return;
    if (!background) setLoading(true);
    setError(false);
    api.skipHire
      .getById(id, token)
      .then((data) => {
        setOrder(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { order, setOrder, loading, error, reload };
}
