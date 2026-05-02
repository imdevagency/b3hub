/**
 * Delivery Calendar — /dashboard/deliveries
 * Date-grouped list of upcoming confirmed orders and transport jobs
 * for the next 6 weeks. Role-aware: shows buyer orders, seller dispatch,
 * and carrier jobs depending on the user's capabilities.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Package, Truck, MapPin, ChevronRight, Leaf } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDeliveryCalendar, type DeliveryCalendarEntry } from '@/lib/api';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Procesā',
  DELIVERED: 'Piegādāts',
  PENDING: 'Gaida',
  ACCEPTED: 'Pieņemts',
  EN_ROUTE_PICKUP: 'Brauc uz iekrāšanu',
  AT_PICKUP: 'Iekrāšanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
  AT_DELIVERY: 'Piegādē',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  DELIVERED: 'secondary',
  PENDING: 'outline',
  ACCEPTED: 'default',
  EN_ROUTE_PICKUP: 'default',
  AT_PICKUP: 'default',
  LOADED: 'default',
  EN_ROUTE_DELIVERY: 'default',
  AT_DELIVERY: 'default',
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Pasūtītājs',
  SELLER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
};

function euro(v: number) {
  return `€${v.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('lv-LV', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Group entries by ISO date key (YYYY-MM-DD), returning sorted pairs */
function groupByDate(entries: DeliveryCalendarEntry[]): [string, DeliveryCalendarEntry[]][] {
  const map: Record<string, DeliveryCalendarEntry[]> = {};
  for (const e of entries) {
    const key = e.deliveryDate.slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

/** Returns "Šodien", "Rīt", or a formatted date string */
function dayLabel(isoDate: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const d = new Date(isoDate + 'T00:00:00');
  if (d.toDateString() === today.toDateString()) return 'Šodien';
  if (d.toDateString() === tomorrow.toDateString()) return 'Rīt';
  return formatDate(isoDate + 'T00:00:00');
}

// ─── entry card ──────────────────────────────────────────────────────────────

function DeliveryRow({ entry, onClick }: { entry: DeliveryCalendarEntry; onClick: () => void }) {
  const isJob = entry.type === 'JOB';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 py-4 px-4 hover:bg-muted/30 rounded-xl transition-colors text-left group"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        {isJob ? (
          <Truck className="h-4.5 w-4.5 text-muted-foreground" />
        ) : (
          <Package className="h-4.5 w-4.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">#{entry.ref}</span>
          <Badge variant={STATUS_VARIANT[entry.status] ?? 'outline'} className="text-xs shrink-0">
            {STATUS_LABELS[entry.status] ?? entry.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{entry.city}</span>
          {entry.materialName && (
            <>
              <span className="mx-1">·</span>
              <Leaf className="h-3 w-3 shrink-0" />
              <span className="truncate">{entry.materialName}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums">{euro(entry.amount)}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{formatTime(entry.deliveryDate)}</span>
          <span className="text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1">
            {ROLE_LABEL[entry.role]}
          </span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<DeliveryCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getDeliveryCalendar(token)
      .then(setEntries)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClick = (entry: DeliveryCalendarEntry) => {
    if (entry.type === 'JOB') {
      router.push(`/dashboard/transport-jobs/${entry.id}`);
    } else {
      router.push(`/dashboard/orders/${entry.id}`);
    }
  };

  if (loading) return <PageSpinner className="min-h-[60vh]" />;

  const groups = groupByDate(entries);

  return (
    <div className="py-8 w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Piegāžu Grafiks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nākamo 6 nedēļu apstiprinātās piegādes un darbi
          </p>
        </div>
      </div>

      {error && (
        <div className="py-8 text-sm text-muted-foreground">Neizdevās ielādēt: {error}</div>
      )}

      {!error && groups.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nav plānotu piegāžu"
          description="Apstiprinātās piegādes tuvākajās 6 nedēļās parādīsies šeit."
        />
      )}

      {groups.map(([dateKey, dayEntries]) => (
        <div key={dateKey} className="mb-8">
          {/* Day header */}
          <div className="flex items-center gap-3 mb-2 px-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-foreground capitalize">
              {dayLabel(dateKey)}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(dateKey + 'T00:00:00').toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-xs text-muted-foreground">{dayEntries.length} ieraksti</span>
          </div>

          {/* Entries */}
          <div className="rounded-2xl ring-1 ring-black/5 shadow-sm bg-background overflow-hidden divide-y divide-border/30">
            {dayEntries.map((e) => (
              <DeliveryRow key={`${e.type}-${e.id}`} entry={e} onClick={() => handleClick(e)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
