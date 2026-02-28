'use client';

import { MapPin, ArrowRight } from 'lucide-react';

interface Step1Props {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}

export function Step1Location({ value, onChange, onNext }: Step1Props) {
  const isValid = value.trim().length >= 3;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) onNext();
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <MapPin className="h-10 w-10 text-red-600" />
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Where should we deliver?</h2>
        <p className="text-gray-500 max-w-sm mx-auto">
          Enter your postal code or city to check availability in your area.
        </p>
      </div>

      {/* Input */}
      <div className="w-full max-w-md space-y-4">
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="e.g. LV-1050 or Riga"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full rounded-xl border-2 border-gray-200 py-4 pl-12 pr-4 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
          />
        </div>

        <button
          onClick={onNext}
          disabled={!isValid}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          Check Availability
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Delivery within 1 working day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          14-day set time included
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Transport &amp; disposal included
        </span>
      </div>
    </div>
  );
}
