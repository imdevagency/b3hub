import { useCallback, useEffect, useState } from 'react';
import { getMyTransportJobs, type ApiTransportJob } from '@/lib/api';

interface UseTransportJobsResult {
  jobs: ApiTransportJob[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches all transport jobs for the current carrier/driver.
 * Used in CarrierHistoryView (orders page).
 */
export function useTransportJobs(token: string | null): UseTransportJobsResult {
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyTransportJobs(token);
      setJobs(data);
    } catch {
      /* no-op: transport job errors are non-fatal */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { jobs, loading, reload };
}
