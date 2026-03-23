/**
 * Step1Container — Order wizard step 1 (container type).
 * User selects the container/vehicle type required for their haulage job.
 */
'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

// ── Container sizes ────────────────────────────────────────────────────────────

export const SKIP_SIZES = [
  {
    id: 'mini',
    label: 'Mini',
    volume: '2 m³',
    dimensions: '1.8m × 1.2m × 0.9m',
    bestFor: 'Maza iztīrīšana, 1–2 istabas',
    priceFrom: 89,
    popular: false,
  },
  {
    id: 'midi',
    label: 'Midi',
    volume: '4 m³',
    dimensions: '2.4m × 1.5m × 1.1m',
    bestFor: 'Virtuves / vannas renovācija',
    priceFrom: 129,
    popular: true,
  },
  {
    id: 'builders',
    label: 'Celtniecības',
    volume: '6 m³',
    dimensions: '3.6m × 1.7m × 1.2m',
    bestFor: 'Pilna mājas iztīrīšana',
    priceFrom: 169,
    popular: false,
  },
  {
    id: 'large',
    label: 'Lielais',
    volume: '8 m³',
    dimensions: '3.9m × 1.8m × 1.4m',
    bestFor: 'Lieli celtniecības projekti',
    priceFrom: 199,
    popular: false,
  },
] as const;

export type SkipSizeId = (typeof SKIP_SIZES)[number]['id'];

// ── Waste types ────────────────────────────────────────────────────────────────

export const WASTE_TYPES = [
  { id: 'mixed', label: 'Jaukti atkritumi', emoji: '🗑️' },
  { id: 'green', label: 'Dārza atkritumi', emoji: '🌿' },
  { id: 'rubble', label: 'Betona gruži', emoji: '🧱' },
  { id: 'wood', label: 'Koks', emoji: '🪵' },
  { id: 'metal', label: 'Metāls / lūžņi', emoji: '⚙️' },
  { id: 'electronics', label: 'Elektronika', emoji: '💻' },
] as const;

export type WasteTypeId = (typeof WASTE_TYPES)[number]['id'];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  size: string;
  wasteType: string;
  onSizeChange: (v: string) => void;
  onWasteChange: (v: string) => void;
  onNext: () => void;
}

export function Step1Container({ size, wasteType, onSizeChange, onWasteChange, onNext }: Props) {
  const [showWaste, setShowWaste] = useState(!!wasteType);
  const canProceed = !!size && !!wasteType;

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">Izvēlieties konteinera izmēru</h2>
        <p className="text-gray-500 text-sm">Cenas iekļauj piegādi, savākšanu un utilizāciju</p>
      </div>

      {/* Size grid */}
      <div className="flex flex-col gap-2">
        {SKIP_SIZES.map((s) => {
          const selected = size === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                onSizeChange(s.id);
                if (!showWaste) setShowWaste(true);
              }}
              className={cn(
                'relative flex items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                  : 'border-transparent bg-muted/60 hover:bg-muted'
              )}
            >
              <div className="flex items-center gap-4">
                {/* Minimal icon */}
                <div
                  className={cn(
                    'shrink-0 flex items-center justify-center rounded border h-10 w-12 transition-colors',
                    selected ? 'border-primary/40 text-primary bg-white shadow-sm' : 'border-gray-200 text-gray-500 bg-gray-100',
                  )}
                >
                  <span className="text-xs font-bold">
                    {s.volume}
                  </span>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn("font-semibold text-sm", selected ? "text-gray-900" : "text-gray-700")}>
                      {s.label}
                    </p>
                    {s.popular && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                        Populārs
                      </span>
                    )}
                  </div>
                  {/* Minimized info */}
                  <p className="text-xs text-muted-foreground mt-0.5">{s.bestFor}</p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted-foreground leading-none">No</p>
                <p className={cn("text-sm font-bold", selected ? "text-primary" : "text-gray-900")}>
                  €{s.priceFrom}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Waste type section — expands after size is chosen */}
      {showWaste && (
        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Atkritumu veids
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {WASTE_TYPES.map((w) => {
              const selected = wasteType === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => onWasteChange(w.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm text-left transition-all',
                    selected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                      : 'border-transparent bg-muted/60 hover:bg-muted'
                  )}
                >
                  <span className="text-lg">{w.emoji}</span>
                  <span className={cn("font-medium text-sm", selected ? "text-gray-900" : "text-gray-700")}>{w.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
      >
        Turpināt
      </button>
    </div>
  );
}
