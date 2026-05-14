/**
 * useFleetPositions hook.
 * Polls /transport-jobs/fleet-positions every 5 seconds and returns
 * a map of jobId → { lat, lng } for the fleet overview map.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFleetPositions } from '@/lib/api';

export interface TruckDot {
  lat: number;
  lng: number;
  updatedAt: string;
}

const POLL_INTERVAL_MS = 5_000;

export function useFleetPositions(token: string | null | undefined) {
  const [positions, setPositions] = useState<Record<string, TruckDot>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getFleetPositions(token);
      const map: Record<string, TruckDot> = {};
      for (const p of data) {
        map[p.jobId] = { lat: p.lat, lng: p.lng, updatedAt: p.updatedAt };
      }
      setPositions(map);
    } catch {
      // silent — stale positions stay on the map rather than causing an error flash
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch();
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, fetch]);

  return positions;
}
