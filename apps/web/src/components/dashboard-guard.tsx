'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { RefreshCw } from 'lucide-react';

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // While auth is hydrating from localStorage, show a full-page spinner
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in — redirect is already queued, render nothing
  if (!user) return null;

  return <>{children}</>;
}
