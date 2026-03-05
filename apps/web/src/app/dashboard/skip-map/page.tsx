'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSkipCarrierMap, type SkipMapOrder, type SkipSize } from '@/lib/api';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ── Dynamic import (no SSR — Mapbox needs browser) ────────────────────────────
const SkipFleetMap = dynamic(() => import('@/components/tracking/SkipFleetMap'), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

// ── Constants & helpers ────────────────────────────────────────────────────────

const SKIP_SIZE_LABEL: Record<SkipSize, string> = {
  MINI: '2m³ Mini',
  MIDI: '4m³ Midi',
  BUILDERS: '6m³ Builders',
  LARGE: '8m³ Large',
};

const WASTE_LABEL: Record<string, string> = {
  MIXED: 'Jaukti atkritumi',
  GREEN_GARDEN: 'Zaļie/dārza',
  CONCRETE_RUBBLE: 'Betona/gruveši',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāllūžņi',
  ELECTRONICS_WEEE: 'Elektronikas WEEE',
};

function daysOnSite(deliveryDate: string): number {
  const d = new Date(deliveryDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-zinc-800">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-zinc-800 px-4 py-3">
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

function SkipCard({
  skip,
  selected,
  onClick,
}: {
  skip: SkipMapOrder;
  selected: boolean;
  onClick: () => void;
}) {
  const isDelivered = skip.status === 'DELIVERED';
  const days = isDelivered ? daysOnSite(skip.deliveryDate) : null;
  const hasCoords = skip.lat !== null && skip.lng !== null;

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-zinc-400">#{skip.orderNumber}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isDelivered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-400/20 text-amber-300'
          }`}
        >
          {isDelivered ? 'Izvietots' : 'Apstiprināts'}
        </span>
      </div>

      {/* Skip details */}
      <p className="mt-1.5 text-sm font-medium text-zinc-100">
        {SKIP_SIZE_LABEL[skip.skipSize]}{' '}
        <span className="font-normal text-zinc-400">
          — {WASTE_LABEL[skip.wasteCategory] ?? skip.wasteCategory}
        </span>
      </p>

      {/* Location */}
      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{skip.location}</span>
        {!hasCoords && (
          <span className="ml-auto flex-shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
            Nav GPS
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500">
        <span>Piegāde: {fmtDate(skip.deliveryDate)}</span>
        {isDelivered && days !== null && (
          <span
            className={`font-semibold ${days > 14 ? 'text-red-400' : days > 7 ? 'text-amber-400' : 'text-zinc-400'}`}
          >
            {days}d. uz vietas
          </span>
        )}
      </div>

      {/* Contact */}
      {skip.contactName && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <Phone className="h-3 w-3" />
          <span>{skip.contactName}</span>
          {skip.contactPhone && <span className="text-zinc-400">{skip.contactPhone}</span>}
        </div>
      )}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type FilterStatus = 'ALL' | 'CONFIRMED' | 'DELIVERED';

export default function SkipMapPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [skips, setSkips] = useState<SkipMapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }
    if (user && !user.canSkipHire) {
      router.push('/dashboard');
      return;
    }
  }, [token, user, router]);

  const loadSkips = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getSkipCarrierMap(token);
      setSkips(data);
      setLastUpdated(new Date());
    } catch {
      setError('Nevarēja ielādēt skipu datus.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load + 30s poll
  useEffect(() => {
    loadSkips();
    pollRef.current = setInterval(() => loadSkips(true), 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token || (user && !user.canSkipHire)) return null;

  // ── Derived state ──────────────────────────────────────────────────────────

  const filtered = skips.filter((s) => (filterStatus === 'ALL' ? true : s.status === filterStatus));

  const countDelivered = skips.filter((s) => s.status === 'DELIVERED').length;
  const countConfirmed = skips.filter((s) => s.status === 'CONFIRMED').length;
  const countNoGps = skips.filter((s) => s.lat === null).length;

  // Pass only visible/selected skips to map (all geolocated)
  const mapSkips = filterStatus === 'ALL' ? skips : filtered;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden p-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Skipu Flotes Karte</h1>
          <p className="text-sm text-zinc-400">Aktīvie skip konteineri izvietoti pie klientiem</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden text-xs text-zinc-500 sm:block">
              Atjaunots: {lastUpdated.toLocaleTimeString('lv-LV')}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadSkips()}
            disabled={loading}
            className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <StatCard label="Izvietoti" value={countDelivered} accent="text-emerald-400" />
        <StatCard label="Apstiprināti" value={countConfirmed} accent="text-amber-400" />
        <StatCard label="Bez GPS" value={countNoGps} accent="text-zinc-400" />
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left panel — skip list */}
        <div className="flex w-72 flex-shrink-0 flex-col gap-3">
          {/* Filter pills */}
          <div className="flex gap-1.5">
            {(['ALL', 'DELIVERED', 'CONFIRMED'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {f === 'ALL' ? 'Visi' : f === 'DELIVERED' ? 'Izvietoti' : 'Apstiprināti'}
              </button>
            ))}
          </div>

          {/* Skip cards */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading && skips.length === 0 ? (
              <div className="flex justify-center pt-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 pt-8 text-center text-zinc-500">
                <Truck className="h-8 w-8" />
                <p className="text-sm">Nav aktīvu skipu</p>
              </div>
            ) : (
              filtered.map((skip) => (
                <SkipCard
                  key={skip.id}
                  skip={skip}
                  selected={selectedId === skip.id}
                  onClick={() => setSelectedId(selectedId === skip.id ? null : skip.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel — map */}
        <div className="min-h-0 flex-1">
          <SkipFleetMap skips={mapSkips} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>
    </div>
  );
}
