'use client';

import { Trash2, Leaf, HardHat, Trees, Cpu, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WasteType = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
};

const WASTE_TYPES: WasteType[] = [
  {
    id: 'mixed',
    label: 'Mixed Waste',
    description: 'General household & commercial waste',
    icon: Trash2,
    color: 'bg-orange-100 text-orange-600 border-orange-200',
  },
  {
    id: 'green',
    label: 'Green / Garden',
    description: 'Grass cuttings, branches, leaves',
    icon: Leaf,
    color: 'bg-green-100 text-green-600 border-green-200',
  },
  {
    id: 'rubble',
    label: 'Concrete & Rubble',
    description: 'Bricks, tiles, concrete, soil',
    icon: HardHat,
    color: 'bg-stone-100 text-stone-600 border-stone-200',
  },
  {
    id: 'wood',
    label: 'Wood',
    description: 'Timber, furniture, pallets',
    icon: Trees,
    color: 'bg-amber-100 text-amber-600 border-amber-200',
  },
  {
    id: 'metal',
    label: 'Metal / Scrap',
    description: 'Steel, aluminium, pipes',
    icon: Package,
    color: 'bg-blue-100 text-blue-600 border-blue-200',
  },
  {
    id: 'electronics',
    label: 'Electronics (WEEE)',
    description: 'Appliances, cables, IT equipment',
    icon: Cpu,
    color: 'bg-purple-100 text-purple-600 border-purple-200',
  },
];

interface Step2Props {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2WasteType({ value, onChange, onNext, onBack }: Step2Props) {
  return (
    <div className="flex flex-col space-y-8">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">What type of waste?</h2>
        <p className="text-gray-500">Select the category that best describes your waste.</p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WASTE_TYPES.map((type) => {
          const Icon = type.icon;
          const selected = value === type.id;
          return (
            <button
              key={type.id}
              onClick={() => {
                onChange(type.id);
              }}
              className={cn(
                'group relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all duration-200 hover:shadow-md focus:outline-none',
                selected
                  ? 'border-red-500 bg-red-50 shadow-md ring-4 ring-red-100'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              {/* Selected indicator */}
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

              {/* Icon */}
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg border-2 transition-colors',
                  selected ? 'bg-red-100 text-red-600 border-red-200' : type.color,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              <div>
                <p className={cn('font-semibold', selected ? 'text-red-700' : 'text-gray-900')}>
                  {type.label}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{type.description}</p>
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
