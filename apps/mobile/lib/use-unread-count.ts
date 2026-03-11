import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

const POLL_INTERVAL_MS = 60_000;

/**
 * Returns the unread notification count for the current user.
 * Polls every minute to keep the badge up to date.
 */
export function useUnreadCount(): number {
  const { token } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetch = () => {
      api.notifications
        .unreadCount(token)
        .then((r) => {
          if (!cancelled) setCount(r.count);
        })
        .catch(() => {});
    };

    fetch();
    const timer = setInterval(fetch, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  return count;
}
