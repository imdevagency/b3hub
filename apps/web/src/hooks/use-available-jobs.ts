import React, { useCallback, useEffect, useState } from 'react';
import {
  getAvailableTransportJobs,
  getMyVehicles,
  getTransportDrivers,
  type ApiTransportJob,
  type Vehicle,
  type ApiDriver,
} from '@/lib/api';

interface UseAvailableJobsResult {
  jobs: ApiTransportJob[];
  setJobs: React.Dispatch<React.SetStateAction<ApiTransportJob[]>>;
  vehicles: Vehicle[];
  drivers: ApiDriver[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Fetches available transport jobs + vehicles + drivers in parallel.
 * Used in the transport jobs marketplace (jobs/page.tsx).
 */
export function useAvailableJobs(token: string | null): UseAvailableJobsResult {
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<ApiDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [jobsData, vehiclesData, driversData] = await Promise.all([
        getAvailableTransportJobs(token),
        getMyVehicles(token).catch(() => [] as Vehicle[]),
        getTransportDrivers(token).catch(() => [] as ApiDriver[]),
      ]);
      setJobs(jobsData);
      setVehicles(vehiclesData);
      setDrivers(driversData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neizdevās ielādēt darbus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { jobs, setJobs, vehicles, drivers, loading, error, reload };
}
