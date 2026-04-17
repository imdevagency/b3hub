/**
 * use-screen-load.ts
 *
 * Generic loading-machinery hook that eliminates the copy-pasted triple of
 *   const [loading, setLoading] = useState(true)
 *   const [refreshing, setRefreshing] = useState(false)
 *   useFocusEffect(useCallback(() => { load(); }, [load]))
 * from every screen.
 *
 * The hook manages loading / refreshing / error state and wires up
 * useFocusEffect automatically.  The caller keeps its own data state and
 * passes a stable fetcher (wrapped in useCallback) that sets it.
 *
 * Usage:
 *   const fetcher = useCallback(async () => {
 *     if (!token) return;
 *     const data = await api.listThings(token);
 *     setThings(data);
 *   }, [token]);
 *
 *   const { loading, refreshing, error, onRefresh } = useScreenLoad(fetcher);
 *
 *   return (
 *     <ScrollView
 *       refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
 *     >
 *       {loading ? <Skeleton /> : <Content />}
 *     </ScrollView>
 *   );
 */

import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export interface UseScreenLoadResult {
  /** True during the first skeleton load (initial mount). */
  loading: boolean;
  /** True while a pull-to-refresh is in progress. */
  refreshing: boolean;
  /** Last error message, or null if the last fetch succeeded. */
  error: string | null;
  /** Pass to <RefreshControl onRefresh={…} />. */
  onRefresh: () => void;
  /** Re-runs the fetcher with the skeleton loader (same as first load). */
  reload: () => void;
}

/**
 * @param fetcher  Stable async function (wrap in useCallback) that performs
 *                 all API calls and updates local state.  Any thrown Error
 *                 is caught and surfaced via the returned `error` string.
 */
export function useScreenLoad(fetcher: () => Promise<void>): UseScreenLoadResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (skeleton: boolean) => {
      if (skeleton) setLoading(true);
      setError(null);
      try {
        await fetcher();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Neizdevās ielādēt datus');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetcher],
  );

  useFocusEffect(
    useCallback(() => {
      run(true);
    }, [run]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    run(false);
  }, [run]);

  const reload = useCallback(() => {
    run(true);
  }, [run]);

  return { loading, refreshing, error, onRefresh, reload };
}
