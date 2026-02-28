'use client';

import { CalendarDays, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step4Props {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  submitting?: boolean;
}

function getTodayString() {
  const d = new Date();
  d.setDate(d.getDate() + 1); // earliest is tomorrow
  return d.toISOString().split('T')[0];
}

function getMaxDateString() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split('T')[0];
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function Step4Date({ value, onChange, onNext, onBack, submitting = false }: Step4Props) {
  const min = getTodayString();
  const max = getMaxDateString();

  return (
    <div className="flex flex-col space-y-8">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">When do you need it?</h2>
        <p className="text-gray-500">
          Choose your preferred delivery date. We deliver within one working day.
        </p>
      </div>

      <div className="space-y-6">
        {/* Quick select buttons */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Quick select</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_OPTIONS.map((opt) => {
              const date = addDays(opt.days);
              const selected = value === date;
              return (
                <button
                  key={opt.label}
                  onClick={() => onChange(date)}
                  className={cn(
                    'rounded-xl border-2 py-3 text-sm font-semibold transition-all duration-200',
                    selected
                      ? 'border-red-500 bg-red-50 text-red-700 ring-4 ring-red-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400 font-medium">or pick a date</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Date picker */}
        <div className="relative">
          <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'w-full rounded-xl border-2 py-4 pl-12 pr-4 text-base text-gray-900 outline-none transition-all',
              value
                ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                : 'border-gray-200 bg-white focus:border-red-500 focus:ring-4 focus:ring-red-50',
            )}
          />
        </div>

        {/* Selected date summary */}
        {value && (
          <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 16 16">
                <path
                  d="M13 4L6.5 10.5 3 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-green-800">Delivery scheduled</p>
              <p className="text-sm text-green-700">{formatDate(value)}</p>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Delivery is confirmed on working days (Mon–Sat). Weekend deliveries may be subject to
            availability. You&apos;ll receive a confirmation email after placing your order.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-xl border-2 border-gray-200 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!value || submitting}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Placing Order…
            </>
          ) : (
            'Place Order →'
          )}
        </button>
      </div>
    </div>
  );
}
