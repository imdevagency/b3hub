'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';

interface MapWizardStep {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MapWizardShellProps {
  title: string;
  /** href for the ‹ back button — navigates away from the wizard */
  backHref: string;
  /** Step definitions — used to compute progress */
  steps: MapWizardStep[];
  /** 1-based current step index */
  step: number;
  /** Right-side map content */
  mapSlot: React.ReactNode;
  /** Optional sticky bottom footer (navigation buttons etc.) */
  footerSlot?: React.ReactNode;
  /** Optional X-close action (shows a close button in the header) */
  onClose?: () => void;
  /** Error banner shown above the step content */
  submitError?: string;
  children: React.ReactNode;
}

export function MapWizardShell({
  title,
  backHref,
  steps,
  step,
  mapSlot,
  footerSlot,
  onClose,
  submitError,
  children,
}: MapWizardShellProps) {
  const progress = Math.min(1, Math.max(0, step / steps.length));

  return (
    <div className="h-[calc(100vh-100px)] w-full bg-background rounded-2xl overflow-hidden shadow-lg border flex flex-col-reverse lg:flex-row">
      {/* ── Left panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-105 shrink-0 flex flex-col bg-white z-10 relative border-t lg:border-t-0 lg:border-r">
        {/* ── Header (matches WizardShell) ─────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
          <Link
            href={backHref}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
            aria-label="Atpakaļ"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </Link>

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

        {/* ── Progress bar (matches WizardShell) ───────────────────── */}
        <div className="relative h-0.5 shrink-0 bg-border/50">
          <div
            className="absolute left-0 top-0 bottom-0 bg-foreground transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* ── Scrollable body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 scrollbar-thin min-h-0">
          {submitError && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Kļūda:</span> {submitError}
            </div>
          )}
          {children}
        </div>

        {/* ── Sticky footer ────────────────────────────────────────── */}
        {footerSlot && <div className="p-5 border-t bg-card shrink-0 z-20">{footerSlot}</div>}
      </div>

      {/* ── Map slot ───────────────────────────────────────────────── */}
      {mapSlot}
    </div>
  );
}
