/**
 * Step1Container — Order wizard step 1 (container type).
 * User selects the container/vehicle type required for their haulage job.
 */
'use client';

import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                'relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md focus:outline-none',
                selected
                  ? 'border-primary bg-red-50 shadow-md ring-4 ring-red-100'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              {s.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white whitespace-nowrap">
                  POPULĀRĀKAIS
                </span>
              )}

              {/* Skip visual */}
              <div className="flex items-end gap-2">
                <div
                  className={cn(
                    'flex items-end justify-center rounded-md border-2 h-12 transition-colors',
                    selected ? 'border-red-400 bg-red-200' : 'border-gray-300 bg-gray-100',
                    s.id === 'mini' && 'w-10',
                    s.id === 'midi' && 'w-14',
                    s.id === 'builders' && 'w-18',
                    s.id === 'large' && 'w-20',
                  )}
                >
                  <span
                    className={cn(
                      'mb-1 text-xs font-bold',
                      selected ? 'text-red-700' : 'text-gray-500',
                    )}
                  >
                    {s.volume}
                  </span>
                </div>
              </div>

              <div>
                <p className={cn('font-bold text-sm', selected ? 'text-red-700' : 'text-gray-900')}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">{s.bestFor}</p>
              </div>

              <p
                className={cn(
                  'text-sm font-bold mt-auto',
                  selected ? 'text-primary' : 'text-gray-800',
                )}
              >
                No €{s.priceFrom}
              </p>
            </button>
          );
        })}
      </div>

      {/* Waste type section — expands after size is chosen */}
      {showWaste && (
        <div className="rounded-2xl border bg-gray-50 overflow-hidden">
          <button
            onClick={() => setShowWaste((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>
              Atkritumu veids
              {wasteType && (
                <span className="ml-2 text-primary">
                  — {WASTE_TYPES.find((w) => w.id === wasteType)?.emoji}{' '}
                  {WASTE_TYPES.find((w) => w.id === wasteType)?.label}
                </span>
              )}
            </span>
            {showWaste ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border-t">
            {WASTE_TYPES.map((w) => {
              const selected = wasteType === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => onWasteChange(w.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm text-left transition-all',
                    selected
                      ? 'border-primary bg-red-50 text-red-700 font-semibold'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <span className="text-base">{w.emoji}</span>
                  <span>{w.label}</span>
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
