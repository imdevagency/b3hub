'use client';

import { CheckCircle2, MapPin, Trash2, Package, CalendarDays, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { SkipWasteCategory, SkipSize } from '@/lib/api';

const WASTE_LABELS: Record<SkipWasteCategory, string> = {
  MIXED: 'Mixed Waste',
  GREEN_GARDEN: 'Green / Garden',
  CONCRETE_RUBBLE: 'Concrete & Rubble',
  WOOD: 'Wood',
  METAL_SCRAP: 'Metal / Scrap',
  ELECTRONICS_WEEE: 'Electronics (WEEE)',
};

const SIZE_LABELS: Record<SkipSize, { label: string; volume: string }> = {
  MINI: { label: 'Mini Skip', volume: '2 m³' },
  MIDI: { label: 'Midi Skip', volume: '4 m³' },
  BUILDERS: { label: "Builder's Skip", volume: '6 m³' },
  LARGE: { label: 'Large Skip', volume: '8 m³' },
};

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface OrderConfirmationProps {
  orderNumber: string;
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  price: number;
  currency: string;
  onReset: () => void;
}

export function OrderConfirmation({
  orderNumber,
  location,
  wasteCategory,
  skipSize,
  deliveryDate,
  price,
  currency,
  onReset,
}: OrderConfirmationProps) {
  const sizeInfo = SIZE_LABELS[skipSize];

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Success icon */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-14 w-14 text-green-600" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">Order Confirmed! 🎉</h2>
        <p className="text-gray-500 max-w-sm mx-auto">
          Your skip has been booked. You&apos;ll receive a confirmation email shortly.
        </p>
      </div>

      {/* Order summary card */}
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-sm text-left overflow-hidden">
        <div className="bg-red-600 px-6 py-4">
          <p className="text-sm font-semibold text-red-100">Order Summary</p>
          <p className="text-xs text-red-200 mt-0.5">Order #{orderNumber}</p>
        </div>

        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Location</p>
              <p className="text-sm font-semibold text-gray-900">{location}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
              <Trash2 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Waste Type
              </p>
              <p className="text-sm font-semibold text-gray-900">{WASTE_LABELS[wasteCategory]}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Skip Size</p>
              <p className="text-sm font-semibold text-gray-900">
                {sizeInfo.label} — {sizeInfo.volume}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
              <CalendarDays className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Delivery Date
              </p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(deliveryDate)}</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm font-semibold text-gray-700">Total (incl. collection)</p>
          <p className="text-xl font-bold text-red-600">
            {currency} {price}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          onClick={onReset}
          className="flex-1 rounded-xl border-2 border-gray-200 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
        >
          Place another order
        </button>
        <Link
          href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-red-700"
        >
          Go to Dashboard
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Confirmation email sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          14-day hire included
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Fully licensed disposal
        </span>
      </div>
    </div>
  );
}
