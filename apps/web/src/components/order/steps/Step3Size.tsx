'use client';

import { cn } from '@/lib/utils';

export type SkipSize = {
  id: string;
  label: string;
  volume: string;
  dimensions: string;
  bestFor: string;
  price: string;
  popular?: boolean;
};

const SKIP_SIZES: SkipSize[] = [
  {
    id: 'mini',
    label: 'Mini Skip',
    volume: '2 m³',
    dimensions: '1.8m × 1.2m × 0.9m',
    bestFor: 'Small clear-outs, 1–2 rooms',
    price: 'From €89',
  },
  {
    id: 'midi',
    label: 'Midi Skip',
    volume: '4 m³',
    dimensions: '2.4m × 1.5m × 1.1m',
    bestFor: 'Kitchen / bathroom renovation',
    price: 'From €129',
    popular: true,
  },
  {
    id: 'builders',
    label: "Builder's Skip",
    volume: '6 m³',
    dimensions: '3.6m × 1.7m × 1.2m',
    bestFor: 'Full house clearance',
    price: 'From €169',
  },
  {
    id: 'large',
    label: 'Large Skip',
    volume: '8 m³',
    dimensions: '3.9m × 1.8m × 1.4m',
    bestFor: 'Large construction projects',
    price: 'From €199',
  },
];

interface Step3Props {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3Size({ value, onChange, onNext, onBack }: Step3Props) {
  return (
    <div className="flex flex-col space-y-8">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Choose your skip size</h2>
        <p className="text-gray-500">
          Pick the size that fits your project. Prices include delivery &amp; collection.
        </p>
      </div>

      {/* Size cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SKIP_SIZES.map((size) => {
          const selected = value === size.id;
          return (
            <button
              key={size.id}
              onClick={() => onChange(size.id)}
              className={cn(
                'relative flex flex-col gap-3 rounded-xl border-2 p-5 text-left transition-all duration-200 hover:shadow-md focus:outline-none',
                selected
                  ? 'border-red-500 bg-red-50 shadow-md ring-4 ring-red-100'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              {/* Popular badge */}
              {size.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-3 py-0.5 text-xs font-bold text-white shadow">
                  MOST POPULAR
                </span>
              )}

              {/* Selected check */}
              {selected && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-600">
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path
                      d="M10 3L5 8.5 2 5.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </span>
              )}

              {/* Skip visual */}
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-14 items-end justify-center rounded-md border-2 transition-colors',
                    selected ? 'border-red-400 bg-red-200' : 'border-gray-300 bg-gray-100',
                    size.id === 'mini' && 'w-12',
                    size.id === 'midi' && 'w-16',
                    size.id === 'builders' && 'w-20',
                    size.id === 'large' && 'w-24',
                  )}
                >
                  <span
                    className={cn(
                      'mb-1 text-xs font-bold',
                      selected ? 'text-red-700' : 'text-gray-500',
                    )}
                  >
                    {size.volume}
                  </span>
                </div>
                <div>
                  <p
                    className={cn(
                      'text-base font-bold',
                      selected ? 'text-red-700' : 'text-gray-900',
                    )}
                  >
                    {size.label}
                  </p>
                  <p className="text-sm text-gray-500">{size.dimensions}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Best for:</span> {size.bestFor}
                </p>
                <p
                  className={cn('text-base font-bold', selected ? 'text-red-600' : 'text-gray-900')}
                >
                  {size.price}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border-2 border-gray-200 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!value}
          className="flex-1 rounded-xl bg-red-600 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
