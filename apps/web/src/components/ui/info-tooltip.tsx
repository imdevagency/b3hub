'use client';

/**
 * InfoTooltip
 *
 * Small ⓘ icon button that opens a Dialog with a plain-language explanation.
 * Use this inline next to confusing terms or abbreviations.
 *
 * @example
 * <span className="flex items-center gap-1">
 *   DPR pašizmaksa
 *   <InfoTooltip term="DPR pašizmaksa">
 *     DPR (Dienas ražošanas atskaite) pašizmaksa ir...
 *   </InfoTooltip>
 * </span>
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InfoTooltipProps {
  /** The heading shown inside the dialog */
  term: string;
  /** The explanation body — can be plain text or JSX */
  children: React.ReactNode;
}

export function InfoTooltip({ term, children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Papildinformācija par "${term}"`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{term}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
