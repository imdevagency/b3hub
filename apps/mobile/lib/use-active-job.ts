import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the server every 30 s to check if the current driver has an active transport job.
 * Used by the driver tab bar to provide a context-aware Jobs / Active tab.
 */
export function useActiveJob(): { hasActiveJob: boolean; activeJobId: string | null } {
  const { token } = useAuth();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setActiveJobId(null);
      return;
    }

    let cancelled = false;

    const fetchJob = () => {
      api.transportJobs
        .myActive(token)
        .then((job) => {
          if (!cancelled) setActiveJobId(job?.id ?? null);
        })
        .catch(() => {});
    };

    fetchJob();
    const timer = setInterval(fetchJob, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  return { hasActiveJob: activeJobId !== null, activeJobId };
}
