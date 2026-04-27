import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api, ApiError } from './api';
import type { ApiTransportJob } from './api';

export const ACTIVE_STATUSES = new Set([
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

// ── Hook ──────────────────────────────────────────────────────

export function useTransportJob(id: string | undefined) {
  const { token, isLoading: authLoading } = useAuth();
  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const reload = useCallback((background = false) => {
    // Wait for auth to finish resolving before making any decision.
    // Prevents a flash of EmptyState while the token is being read from storage,
    // followed by a fresh API call that resets loading=true (the visible "hang").
    if (authLoading) return;

    if (!token || !id) {
      setLoading(false);
      return;
    }

    if (!background) setLoading(true);
    setAccessDenied(false);
    api.transportJobs
      .getOne(id, token)
      .then((found) => {
        setJob(found ?? null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
        }
        setJob(null);
      })
      .finally(() => setLoading(false));
  }, [id, token, authLoading]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll every 10 s while job is actively in-progress
  useEffect(() => {
    if (!job || !ACTIVE_STATUSES.has(job.status)) return;
    const interval = setInterval(() => reload(true), 10_000);
    return () => clearInterval(interval);
  }, [job?.status, reload]);

  return { job, loading, reload, accessDenied };
}
