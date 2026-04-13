'use client';

import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardShellProps {
  /** Extra classes applied to the outer wrapper */
  className?: string;
  /** 1-based current step. Pass 0 to hide the progress bar (e.g. history tab). */
  step: number;
  /** Total number of steps */
  totalSteps: number;
  /** Header title */
  title: string;
  /** Optional content rendered between the title row and the progress bar (e.g. tab switcher) */
  headerSlot?: React.ReactNode;
  /** Called when the back arrow is clicked. Pass null/undefined to hide the button. */
  onBack?: (() => void) | null;
  /** Called when the X button is clicked */
  onClose?: () => void;
  children: React.ReactNode;
}

export function WizardShell({
  className,
  step,
  totalSteps,
  title,
  headerSlot,
  onBack,
  onClose,
  children,
}: WizardShellProps) {
  const progress = Math.min(1, Math.max(0, step / totalSteps));

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            aria-label="Atpakaļ"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </button>
        ) : (
          <div className="size-9 shrink-0" />
        )}

        <h2 className="flex-1 text-center text-[15px] font-bold text-foreground truncate">
          {title}
        </h2>

        {onClose ? (
          <button
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            aria-label="Aizvērt"
          >
            <X className="size-4 text-foreground" />
          </button>
        ) : (
          <div className="size-9 shrink-0" />
        )}
      </div>

      {/* ── Optional header slot (e.g. tab switcher) ────────────── */}
      {headerSlot && <div className="px-4 pb-2 shrink-0">{headerSlot}</div>}

      {/* ── Progress bar ────────────────────────────────────────── */}
      {step > 0 && (
        <div className="relative h-0.5 shrink-0 bg-border/50">
          <div
            className="absolute left-0 top-0 bottom-0 bg-foreground transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-6">{children}</div>
    </div>
  );
}
