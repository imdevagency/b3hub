/**
 * PageHeader
 *
 * Consistent top-of-page header used by every dashboard page.
 * Renders the page title, an optional description, and an optional action slot
 * (typically a primary Button or a set of Buttons).
 *
 * Use this as the FIRST element inside every dashboard page — never write your own
 * <h1> or title div directly in a page.
 *
 * @example
 * // Simple
 * <PageHeader title="Pasūtījumi" />
 *
 * // With description
 * <PageHeader
 *   title="Materiālu Katalogs"
 *   description="Pārvaldiet savus materiālu piedāvājumus"
 * />
 *
 * // With action button
 * <PageHeader
 *   title="Mani Materiāli"
 *   description="Izveidojiet un rediģējiet materiālu sarakstus"
 *   action={<Button onClick={openForm}><Plus className="h-4 w-4 mr-1.5" />Jauns materiāls</Button>}
 * />
 *
 * // With multiple actions
 * <PageHeader
 *   title="Darbu Tirgus"
 *   action={
 *     <div className="flex items-center gap-2">
 *       <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4" /></Button>
 *       <Button onClick={openFilter}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filtri</Button>
 *     </div>
 *   }
 * />
 */

import React from 'react';

export interface PageHeaderProps {
  /** Primary heading — shown as h1. Keep short (1–4 words). */
  title: string;
  /** Supporting text shown below the title. Optional. */
  description?: string;
  /**
   * Slot for action buttons — placed at the right end of the header.
   * Pass a single <Button> or a <div className="flex gap-2"> group.
   */
  action?: React.ReactNode;
  /** Extra className applied to the outer wrapper div. */
  className?: string;
}

export function PageHeader({ title, description, action, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
