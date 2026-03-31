import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

const POLL_INTERVAL_MS = 60_000;

/**
 * Returns the number of open (pending) quote requests the seller can respond to.
 * Polls every minute to keep the badge up to date.
 * Used by the seller tab bar to badge the Quotes tab.
 */
export function useOpenQuoteCount(): number {
  const { token } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetchCount = () => {
      api.quoteRequests
        .openRequests(token)
        .then((items) => {
          if (!cancelled) setCount(items.length);
        })
        .catch(() => {});
    };

    fetchCount();
    const timer = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  return count;
}
