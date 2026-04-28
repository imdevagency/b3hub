import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

const POLL_INTERVAL_MS = 30_000;

/**
 * Returns the unread chat message count for the current user.
 * Polls every 30 seconds. The count resets for each room when the user opens it
 * (the backend records a lastReadAt timestamp on message fetch).
 */
export function useChatUnreadCount(): number {
  const { token } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetchCount = () => {
      api.chat
        .unreadCount(token)
        .then((r) => {
          if (!cancelled) setCount(r.count);
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
