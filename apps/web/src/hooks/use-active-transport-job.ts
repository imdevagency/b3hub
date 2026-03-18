import React, { useCallback, useEffect, useState } from 'react';
import { getMyActiveTransportJob, type ApiTransportJob } from '@/lib/api';

interface UseActiveTransportJobResult {
  job: ApiTransportJob | null;
  setJob: React.Dispatch<React.SetStateAction<ApiTransportJob | null>>;
  loading: boolean;
  reload: () => Promise<void>;
}

const IN_PROGRESS_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];

/**
 * Fetches the current driver's in-progress transport job.
 * Returns null when no active job or status is outside IN_PROGRESS_STATUSES.
 * Used in ActiveJobTab (orders page).
 */
export function useActiveTransportJob(token: string | null): UseActiveTransportJobResult {
  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getMyActiveTransportJob(token);
      const isActive =
        data != null &&
        IN_PROGRESS_STATUSES.includes(data.status) &&
        data.status !== 'DELIVERED';
      setJob(isActive ? data : null);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { job, setJob, loading, reload };
}
