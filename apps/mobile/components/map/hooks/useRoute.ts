/**
 * useRoute — fetches a real driving route between two stops.
 *
 * Wraps fetchRoute() from lib/maps.ts in a React hook so view components
 * never need to manage their own fetch state.
 *
 * Usage:
 *   const { route, loading } = useRoute(pickup, delivery);
 *   // route is null while loading or if origin/destination are null
 */
import { useState, useEffect } from 'react';
import { fetchRoute, RouteInfo, Stop } from '@/lib/maps';

interface UseRouteResult {
  route: RouteInfo | null;
  loading: boolean;
}

export function useRoute(
  origin: Stop | null | undefined,
  destination: Stop | null | undefined,
): UseRouteResult {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchRoute(origin, destination).then((r) => {
      if (!cancelled) {
        setRoute(r);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return { route, loading };
}
