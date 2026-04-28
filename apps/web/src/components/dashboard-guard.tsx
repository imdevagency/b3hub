/**
 * DashboardGuard component.
 * Client-side auth redirect — wraps dashboard pages and pushes unauthenticated
 * users to /login.
 *
 * In admin mode (NEXT_PUBLIC_APP_MODE=admin) non-ADMIN users are rejected even
 * if they have a valid token — they may have logged in on the marketplace and
 * their token was stored in localStorage.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { RefreshCw } from 'lucide-react';

const IS_ADMIN_APP = process.env.NEXT_PUBLIC_APP_MODE === 'admin';

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Admin app: non-admin users are silently logged out and sent to login
    if (IS_ADMIN_APP && user.userType !== 'ADMIN') {
      logout();
      router.replace('/login');
    }
  }, [isLoading, user, router, logout]);

  // While auth is hydrating from localStorage, show a full-page spinner
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in, or wrong user type in admin app — redirect already queued
  if (!user) return null;
  if (IS_ADMIN_APP && user.userType !== 'ADMIN') return null;

  return <>{children}</>;
}
