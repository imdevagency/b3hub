/**
 * MatStep3When — Materials order wizard step 3 (When: delivery date).
 * Simple single-day date picker.
 */
'use client';

import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtFull(d: Date) {
  return d.toLocaleDateString('lv-LV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  deliveryDate: string;
  onDateChange: (date: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MatStep3When({ deliveryDate, onDateChange, onNext, onBack }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  const selected = deliveryDate
    ? (() => {
        const [y, m, d] = deliveryDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;

  return (
    <div className="flex flex-col space-y-5">
      <div>
        <h2 className="text-lg font-bold">Kad piegādāt?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Izvēlieties vēlamo piegādes datumu
        </p>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border overflow-hidden">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onDateChange(toISO(d))}
          disabled={{ before: tomorrow }}
          className="p-3"
        />
      </div>

      {/* Confirmed date pill */}
      {deliveryDate && selected && (
        <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
          <CalendarDays className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">
            Piegāde: {fmtFull(selected)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Atpakaļ
        </button>
        <button
          onClick={onNext}
          disabled={!deliveryDate}
          className="flex-2 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          Tālāk — kontaktinformācija
        </button>
      </div>
    </div>
  );
}
