/**
 * Certificates page — /dashboard/certificates
 * Waste disposal compliance records and recycling certificates.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Award, ExternalLink, RefreshCw, ShieldCheck, Clock, Recycle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyWasteRecords, type ApiWasteRecord, type WasteType } from '@/lib/api';

// ─── Config ──────────────────────────────────────────────────────────────────

const WASTE_TYPE_LV: Record<WasteType, string> = {
  CONCRETE: 'Betons',
  BRICK:    'Ķieģeļi',
  WOOD:     'Koks',
  METAL:    'Metāls',
  PLASTIC:  'Plastmasa',
  SOIL:     'Zeme',
  MIXED:    'Jaukti',
  HAZARDOUS:'Bīstamie',
};

const WASTE_TYPE_COLOR: Record<WasteType, string> = {
  CONCRETE: 'bg-gray-100 text-gray-700 border-gray-200',
  BRICK:    'bg-orange-100 text-orange-800 border-orange-200',
  WOOD:     'bg-amber-100 text-amber-800 border-amber-200',
  METAL:    'bg-slate-100 text-slate-700 border-slate-200',
  PLASTIC:  'bg-sky-100 text-sky-700 border-sky-200',
  SOIL:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  MIXED:    'bg-purple-100 text-purple-700 border-purple-200',
  HAZARDOUS:'bg-red-100 text-red-800 border-red-200',
};

const FILTER_OPTIONS = ['ALL', 'CERTIFIED', 'PENDING'] as const;
type FilterKey = (typeof FILTER_OPTIONS)[number];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record }: { record: ApiWasteRecord }) {
  const typeLabel = WASTE_TYPE_LV[record.wasteType] ?? record.wasteType;
  const typeColor = WASTE_TYPE_COLOR[record.wasteType] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const hasCert = !!record.certificateUrl;

  return (
    <Card className="shadow-none border-border/60 hover:border-border transition-colors">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {/* Left: record info */}
          <div className="flex items-start gap-4 flex-1">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${hasCert ? 'bg-green-100' : 'bg-amber-100'}`}>
              {hasCert
                ? <ShieldCheck className="h-5 w-5 text-green-600" />
                : <Clock className="h-5 w-5 text-amber-600" />
              }
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`text-xs font-medium border ${typeColor}`}>
                  {typeLabel}
                </Badge>
                {hasCert ? (
                  <Badge className="text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Sertificēts
                  </Badge>
                ) : (
                  <Badge className="text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Gaida sertifikātu
                  </Badge>
                )}
              </div>
              <div className="text-sm font-medium text-foreground">
                {record.recyclingCenter.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {record.recyclingCenter.address}, {record.recyclingCenter.city}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{record.weight.toLocaleString('lv-LV')} kg</span>
                {record.volume && <span>{record.volume} m³</span>}
                {record.recyclingRate != null && (
                  <span className="flex items-center gap-1 text-green-700 font-medium">
                    <Recycle className="h-3 w-3" />
                    {record.recyclingRate.toFixed(0)}% pārstrāde
                  </span>
                )}
                {record.processedDate && (
                  <span>Apstrādāts: {fmtDate(record.processedDate)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: date + certificate button */}
          <div className="flex flex-row sm:flex-col items-end gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">{fmtDate(record.createdAt)}</span>
            {hasCert && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => window.open(record.certificateUrl!, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Lejupielādēt
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryBar({ records }: { records: ApiWasteRecord[] }) {
  const total = records.length;
  const certified = records.filter((r) => !!r.certificateUrl).length;
  const totalWeight = records.reduce((sum, r) => sum + r.weight, 0);
  const avgRate =
    records.filter((r) => r.recyclingRate != null).length > 0
      ? records.reduce((sum, r) => sum + (r.recyclingRate ?? 0), 0) /
        records.filter((r) => r.recyclingRate != null).length
      : null;

  if (total === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Kopā ieraksti', value: String(total) },
        { label: 'Sertificēti', value: `${certified} / ${total}` },
        { label: 'Kopā svars', value: `${(totalWeight / 1000).toFixed(1)} t` },
        { label: 'Vid. pārstrāde', value: avgRate != null ? `${avgRate.toFixed(0)}%` : '—' },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-center">
          <p className="text-lg font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<ApiWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyWasteRecords(token);
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered =
    filter === 'ALL'
      ? records
      : filter === 'CERTIFIED'
      ? records.filter((r) => !!r.certificateUrl)
      : records.filter((r) => !r.certificateUrl);

  const filterLabel: Record<FilterKey, string> = {
    ALL: 'Visi',
    CERTIFIED: 'Sertificēti',
    PENDING: 'Gaida',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifikāti"
        description="Atkritumu utilizācijas ieraksti un atbilstības sertifikāti"
        action={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      <SummaryBar records={records} />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
              filter === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {filterLabel[key]}
            {key === 'CERTIFIED' && (
              <span className="ml-1.5 tabular-nums">
                {records.filter((r) => !!r.certificateUrl).length}
              </span>
            )}
            {key === 'PENDING' && (
              <span className="ml-1.5 tabular-nums">
                {records.filter((r) => !r.certificateUrl).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Award}
          title={filter === 'ALL' ? 'Nav utilizācijas ierakstu' : 'Nav ierakstu ar šo statusu'}
          description={
            filter === 'ALL'
              ? 'Sertifikāti tiek ģenerēti automātiski pēc atkritumu utilizācijas pasūtījuma pabeigšanas'
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}
