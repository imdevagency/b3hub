/**
 * Step1Container — Order wizard step 1 (container type).
 * User selects the container/vehicle type required for their haulage job.
 */
'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getSkipHireMarketPrices, type SkipMarketPrices } from '@/lib/api';
import {
  Check,
  Package,
  Ruler,
  Trash2,
  Leaf,
  Box,
  Pickaxe,
  Settings,
  MonitorSpeaker,
} from 'lucide-react';

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
  { id: 'mixed', label: 'Jaukti atkritumi', icon: Trash2 },
  { id: 'green', label: 'Dārza atkritumi', icon: Leaf },
  { id: 'rubble', label: 'Betona gruži', icon: Box },
  { id: 'wood', label: 'Koks', icon: Pickaxe },
  { id: 'metal', label: 'Metāls / lūžņi', icon: Settings },
  { id: 'electronics', label: 'Elektronika', icon: MonitorSpeaker },
] as const;

export type WasteTypeId = (typeof WASTE_TYPES)[number]['id'];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  size: string;
  wasteType: string;
  onSizeChange: (v: string) => void;
  onWasteChange: (v: string) => void;
  onNext: () => void;
  /** Optional pre-fetched market prices. If omitted, fetched internally. */
  minPrices?: SkipMarketPrices;
}

export function Step1Container({
  size,
  wasteType,
  onSizeChange,
  onWasteChange,
  onNext,
  minPrices: minPricesProp,
}: Props) {
  // showSize reveals the size grid after the user picks a waste type.
  const [showSize, setShowSize] = useState(!!wasteType);
  const canProceed = !!size && !!wasteType;
  const [marketPrices, setMarketPrices] = useState<SkipMarketPrices | null>(minPricesProp ?? null);

  useEffect(() => {
    if (minPricesProp) {
      queueMicrotask(() => setMarketPrices(minPricesProp));
      return;
    }
    getSkipHireMarketPrices()
      .then(setMarketPrices)
      .catch(() => null); // silent — falls back to hardcoded defaults below
  }, [minPricesProp]);

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">Ko izvest?</h2>
        <p className="text-gray-500 text-sm">
          Atkritumu veids nosaka, kādu konteineru varam piedāvāt
        </p>
      </div>

      {/* Waste type grid — always visible first */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Atkritumu veids</h3>
        <div className="grid grid-cols-2 gap-2">
          {WASTE_TYPES.map((w) => {
            const selected = wasteType === w.id;
            return (
              <button
                key={w.id}
                onClick={() => {
                  onWasteChange(w.id);
                  if (!showSize) setShowSize(true);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-sm text-left transition-all',
                  selected
                    ? 'border-black bg-gray-50 ring-1 ring-black'
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                    selected ? 'bg-black text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  <w.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    'font-semibold text-sm',
                    selected ? 'text-gray-900' : 'text-gray-700',
                  )}
                >
                  {w.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Size grid — expands after waste type is chosen */}
      {showSize && (
        <div className="pt-2 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Konteinera izmērs</h3>
          <div className="grid grid-cols-2 gap-3">
            {SKIP_SIZES.map((s) => {
              const selected = size === s.id;
              const price = marketPrices?.[s.id as keyof SkipMarketPrices] ?? s.priceFrom;
              return (
                <button
                  key={s.id}
                  onClick={() => onSizeChange(s.id)}
                  className={cn(
                    'relative text-left rounded-2xl border-2 p-4 transition-all bg-white flex flex-col gap-2',
                    selected
                      ? 'border-black ring-1 ring-black bg-gray-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-400 hover:shadow-sm',
                  )}
                >
                  {s.popular && !selected && (
                    <span className="absolute -top-2.5 left-3 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white tracking-wide">
                      POPULĀRS
                    </span>
                  )}
                  {selected && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-black flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        selected ? 'bg-black text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{s.label}</p>
                      <p className="text-xs text-gray-400 font-medium">{s.volume}</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-snug">{s.bestFor}</p>
                  <div className="mt-auto pt-2 border-t border-gray-100 flex items-baseline gap-1">
                    <span className="text-xs text-gray-400">no</span>
                    <span
                      className={cn(
                        'text-base font-bold',
                        selected ? 'text-black' : 'text-gray-900',
                      )}
                    >
                      €{price}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Ruler className="h-3 w-3 shrink-0" />
                    <span>{s.dimensions}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full rounded-2xl bg-black py-4 text-base font-bold text-white shadow-md transition-all hover:bg-gray-800 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
      >
        Turpināt
      </button>
    </div>
  );
}
