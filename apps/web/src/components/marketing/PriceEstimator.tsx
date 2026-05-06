'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface FuelRates {
  diesel: number;
  fuelMultiplier: number;
  truckLPer100km: number;
  source: string;
  updatedAt: string;
}

type ServiceType = 'materials' | 'skip' | 'transport' | 'disposal';

const SERVICE_LABELS: Record<ServiceType, string> = {
  materials: 'Būvmateriāli',
  skip: 'Konteinera noma',
  transport: 'Transports',
  disposal: 'Atkritumu nodošana',
};

interface SliderCfg {
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

interface ServiceDef {
  s1: SliderCfg;
  s2: SliderCfg;
  estimate: (v1: number, v2: number) => [number, number];
  resultLabel: string;
}

const SERVICES: Record<ServiceType, ServiceDef> = {
  materials: {
    s1: { label: 'Daudzums', unit: 't', min: 1, max: 200, default: 20, step: 1 },
    s2: { label: 'Piegādes attālums', unit: 'km', min: 5, max: 150, default: 40, step: 5 },
    estimate: (qty, km) => [qty * 7 + km * 1.1, qty * 14 + km * 1.6],
    resultLabel: 'Provizoriskās kopējās izmaksas',
  },
  skip: {
    s1: { label: 'Konteinera tilpums', unit: 'm³', min: 4, max: 30, default: 8, step: 2 },
    s2: { label: 'Nomas ilgums', unit: 'ned.', min: 1, max: 12, default: 2, step: 1 },
    estimate: (m3, weeks) => [m3 * 8 + weeks * 55 + 80, m3 * 12 + weeks * 70 + 150],
    resultLabel: 'Provizoriskās kopējās izmaksas',
  },
  transport: {
    s1: { label: 'Attālums', unit: 'km', min: 10, max: 500, default: 80, step: 10 },
    s2: { label: 'Kravas svars', unit: 't', min: 1, max: 30, default: 10, step: 1 },
    estimate: (km, t) => [km * 1.1 + t * 2 + 50, km * 1.6 + t * 3 + 80],
    resultLabel: 'Provizoriskā transporta maksa',
  },
  disposal: {
    s1: { label: 'Atkritumu daudzums', unit: 't', min: 1, max: 100, default: 10, step: 1 },
    s2: { label: 'Attālums līdz laukumam', unit: 'km', min: 5, max: 150, default: 30, step: 5 },
    estimate: (qty, km) => [qty * 12 + km * 0.8, qty * 25 + km * 1.4],
    resultLabel: 'Provizoriskās nodošanas izmaksas',
  },
};

function SliderRow({
  cfg,
  value,
  onChange,
}: {
  cfg: SliderCfg;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground font-medium">{cfg.label}</span>
        <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1 min-w-20 justify-end bg-background">
          <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground ml-1">{cfg.unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-foreground cursor-pointer"
      />
    </div>
  );
}

interface PriceEstimatorProps {
  variant?: 'section' | 'card';
}

export function PriceEstimator({ variant = 'section' }: PriceEstimatorProps) {
  const [service, setService] = useState<ServiceType>('materials');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fuelRates, setFuelRates] = useState<FuelRates | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const def = SERVICES[service];
  const [v1, setV1] = useState(def.s1.default);
  const [v2, setV2] = useState(def.s2.default);

  // Fetch live diesel price once on mount
  useEffect(() => {
    fetch(`${API_URL}/public/price-rates`)
      .then((r) => r.json())
      .then((d: FuelRates) => setFuelRates(d))
      .catch(() => {
        /* silent — hardcoded estimates still shown */
      });
  }, []);

  const multiplier = service === 'transport' && fuelRates ? fuelRates.fuelMultiplier : 1;
  const [lo, hi] = def.estimate(v1, v2).map((v) => v * multiplier) as [number, number];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleServiceChange = (s: ServiceType) => {
    setService(s);
    setV1(SERVICES[s].s1.default);
    setV2(SERVICES[s].s2.default);
    setDropdownOpen(false);
  };

  const card = (
    <div className="bg-background rounded-3xl border border-border shadow-md overflow-visible w-full max-w-sm mx-auto">
      {/* Service selector — custom dropdown */}
      <div ref={dropdownRef} className="relative rounded-t-3xl border-b border-border">
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-base font-semibold text-foreground bg-transparent focus:outline-none"
        >
          <span>{SERVICE_LABELS[service]}</span>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-50 bg-background border border-border rounded-2xl shadow-lg mt-1 overflow-hidden">
            {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleServiceChange(s)}
                className={`w-full text-left px-5 py-3.5 text-sm font-medium transition-colors ${
                  s === service
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-neutral-100'
                }`}
              >
                {SERVICE_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-6 flex flex-col gap-6">
        <SliderRow cfg={def.s1} value={v1} onChange={setV1} />
        <SliderRow cfg={def.s2} value={v2} onChange={setV2} />

        {/* Result row */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground leading-snug max-w-30">{def.resultLabel}</p>
          <div className="text-right">
            {service === 'transport' && fuelRates && (
              <p className="text-xs text-amber-600 font-medium mb-1">
                ⛽ Dīzelis {fuelRates.diesel.toFixed(3)} €/L
              </p>
            )}
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
              no €{Math.round(lo).toLocaleString('lv-LV')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              vidēji līdz €{Math.round(hi).toLocaleString('lv-LV')}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/order"
          className="block w-full text-center bg-foreground text-background rounded-full py-3.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Pasūtīt tagad
        </Link>

        <p className="text-center text-xs text-muted-foreground -mt-3">
          Provizoriski · Nav juridiski saistošs
        </p>
      </div>
    </div>
  );

  if (variant === 'card') return card;

  return (
    <section className="w-full bg-neutral-50 border-y border-border">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center text-center mb-10">
          <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-3">
            Indikatīvais kalkulators
          </p>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tighter leading-tight mb-3">
            Cik tas izmaksās?
          </h2>
          <p className="text-base text-muted-foreground font-light max-w-md">
            Aptuvens cenu diapazons. Precīzas cenas — pēc reģistrācijas un adreses ievades.
          </p>
        </div>
        {card}
      </div>
    </section>
  );
}
