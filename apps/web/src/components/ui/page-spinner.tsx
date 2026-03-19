/**
 * PageSpinner component.
 * Centred loading indicator for data-fetching states inside dashboard pages.
 * Replaces the repeated inline `<Loader2 animate-spin>` / `<RefreshCw animate-spin>`
 * patterns that were copy-pasted across every page.
 *
 * @example
 *   if (loading) return <PageSpinner />;
 */
import { Loader2 } from 'lucide-react';

interface PageSpinnerProps {
  /** Optional height of the container. Defaults to 'h-64'. */
  className?: string;
}

export function PageSpinner({ className = 'h-64' }: PageSpinnerProps) {
  return (
    <div className={`flex items-center justify-center w-full ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
