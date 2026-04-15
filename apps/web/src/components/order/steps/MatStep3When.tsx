/**
 * MatStep3When — Materials order wizard step 3 (When: delivery date + staggered trucks).
 */
'use client';

import { CalendarDays, Minus, Plus, Truck, Zap } from 'lucide-react';
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

const INTERVAL_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 90, label: '1.5 h' },
  { value: 120, label: '2 h' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  deliveryDate: string;
  onDateChange: (date: string) => void;
  deliveryWindow?: 'ANY' | 'AM' | 'PM';
  onDeliveryWindowChange?: (window: 'ANY' | 'AM' | 'PM') => void;
  asap?: boolean;
  onAsapChange?: (v: boolean) => void;
  truckCount: number;
  onTruckCountChange: (n: number) => void;
  truckIntervalMinutes: number;
  onTruckIntervalChange: (mins: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MatStep3When({
  deliveryDate,
  onDateChange,
  deliveryWindow = 'ANY',
  onDeliveryWindowChange,
  asap = false,
  onAsapChange,
  truckCount,
  onTruckCountChange,
  truckIntervalMinutes,
  onTruckIntervalChange,
  onNext,
  onBack,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  const selected = deliveryDate
    ? (() => {
        const [y, m, d] = deliveryDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;

  const DELIVERY_WINDOWS = [
    { id: 'ANY' as const, label: 'Jebkurā laikā' },
    { id: 'AM' as const, label: 'Rītā (8:00–13:00)' },
    { id: 'PM' as const, label: 'Pēcpusdienā (13:00–18:00)' },
  ];

  return (
    <div className="flex flex-col space-y-5">
      <div>
        <h2 className="text-lg font-bold">Kad piegādāt?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Izvēlieties vēlamo piegādes datumu</p>
      </div>

      {/* ASAP toggle */}
      {onAsapChange && (
        <button
          type="button"
          onClick={() => onAsapChange(!asap)}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            asap
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-background border-border text-foreground hover:bg-muted'
          }`}
        >
          <Zap className={`size-4 shrink-0 ${asap ? 'text-amber-600' : 'text-muted-foreground'}`} />
          <span>
            <span className="font-semibold">Cik drīz iespējams</span>
            <span className="ml-1 text-muted-foreground font-normal">(datums mainīsies)</span>
          </span>
          {asap && (
            <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
              ASAP
            </span>
          )}
        </button>
      )}

      {/* Delivery window */}
      {onDeliveryWindowChange && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Vēlamais piegādes laiks</p>
          <div className="flex flex-col gap-2">
            {DELIVERY_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onDeliveryWindowChange(w.id)}
                className={`rounded-xl border py-2.5 px-4 text-sm font-medium text-left transition-colors ${
                  deliveryWindow === w.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div
        className={`rounded-2xl border overflow-hidden transition-opacity ${asap ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onDateChange(toISO(d))}
          disabled={{ before: tomorrow }}
          className="p-3"
        />
      </div>

      {/* Confirmed date pill */}
      {asap ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <Zap className="size-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-800">Piegāde: cik drīz iespējams</span>
        </div>
      ) : deliveryDate && selected ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
          <CalendarDays className="size-4 text-black shrink-0" />
          <span className="text-sm font-semibold text-primary">Piegāde: {fmtFull(selected)}</span>
        </div>
      ) : null}

      {/* Multi-truck staggered delivery */}
      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Kravas automašīnu skaits</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onTruckCountChange(Math.max(1, truckCount - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-10 text-center text-lg font-bold">{truckCount}</span>
          <button
            type="button"
            onClick={() => onTruckCountChange(truckCount + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
          >
            <Plus className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {truckCount === 1 ? 'Viena piegāde' : `${truckCount} atsevišķas piegādes`}
          </span>
        </div>

        {truckCount > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Intervāls starp automašīnām
            </p>
            <div className="flex gap-2">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTruckIntervalChange(opt.value)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    truckIntervalMinutes === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              1. auto: bāzes laiks · 2. auto: +{truckIntervalMinutes} min · utt.
            </p>
          </div>
        )}
      </div>

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
          disabled={!deliveryDate && !asap}
          className="flex-2 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          Tālāk — kontaktinformācija
        </button>
      </div>
    </div>
  );
}
