'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, LayoutDashboard } from 'lucide-react';

/**
 * Next.js App Router dashboard error boundary.
 * Catches uncaught errors inside /dashboard/** without crashing the
 * root layout (navbar, sidebar etc. stay intact).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Page failed to load</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          An error occurred while rendering this page. Your data is safe — try refreshing.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-3 max-w-xl overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => router.push('/dashboard')} className="gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
      </div>
    </div>
  );
}
