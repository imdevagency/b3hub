/**
 * Root error boundary page.
 * Catches unhandled render errors at the root level and shows a recovery UI.
 */
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Next.js App Router root error boundary.
 * Shown when an uncaught error bubbles up to the root route segment.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-sm max-w-md">
          An unexpected error occurred. Please try refreshing the page or contact support if the
          problem persists.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-4 max-w-xl overflow-auto rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Go home
        </Button>
      </div>
    </div>
  );
}
