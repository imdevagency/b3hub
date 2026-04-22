import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';
import type { ApiTransportJob } from './api';

export const ACTIVE_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

// ── Hook ──────────────────────────────────────────────────────

export function useTransportJob(id: string | undefined) {
  const { token } = useAuth();
  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback((background = false) => {
    if (!token || !id) {
      setLoading(false);
      return;
    }

    if (!background) setLoading(true);
    api.transportJobs
      .getOne(id, token)
      .then((found) => {
        setJob(found ?? null);
      })
      .catch(() => {
        setJob(null);
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll every 10 s while job is actively in-progress
  useEffect(() => {
    if (!job || !ACTIVE_STATUSES.has(job.status)) return;
    const interval = setInterval(() => reload(true), 10_000);
    return () => clearInterval(interval);
  }, [job?.status, reload]);

  return { job, loading, reload };
}
