/**
 * EmptyState
 *
 * Consistent empty-list / zero-data placeholder for every dashboard page.
 * Replaces the one-off inline implementations that every page was writing.
 *
 * Use whenever a list, table, or data section has no items to show.
 * On loading, show <PageSpinner> instead.
 *
 * @example
 * // Minimal
 * {orders.length === 0 && (
 *   <EmptyState icon={ClipboardList} title="Nav pasūtījumu" />
 * )}
 *
 * // Full
 * <EmptyState
 *   icon={Package}
 *   title="Nav materiālu"
 *   description="Pievienojiet pirmo materiālu, lai sāktu saņemt pasūtījumus"
 *   action={
 *     <Button onClick={openForm}>
 *       <Plus className="h-4 w-4 mr-1.5" />Pievienot materiālu
 *     </Button>
 *   }
 * />
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  /** Lucide icon shown inside the icon circle. */
  icon: LucideIcon;
  /** Primary message. Keep it under 6 words. */
  title: string;
  /** Secondary explanation. Optional. */
  description?: string;
  /** Optional action — usually a single primary Button. */
  action?: React.ReactNode;
  /** Override the outer wrapper className (e.g. to control min-height). */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-20 text-center ${className}`}
    >
      {/* Icon circle */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Text */}
      <div className="max-w-xs">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>

      {/* Action */}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
