/**
 * useRequireAuth hook.
 * Redirects unauthenticated users to the given path (default '/').
 * Use this instead of manually writing the auth-redirect useEffect in every page.
 *
 * @example
 *   const { user, token } = useRequireAuth();
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function useRequireAuth(redirectTo = '/') {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.token) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.token, router, redirectTo]);

  return auth;
}
