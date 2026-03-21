/**
 * Framework contracts page — /dashboard/framework-contracts
 * Long-term supply contracts with call-off tracking.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getFrameworkContracts,
  type ApiFrameworkContract,
  type FrameworkContractStatus,
  type FrameworkPositionType,
} from '@/lib/api';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  FrameworkContractStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  ACTIVE: {
    label: 'Aktīvs',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  COMPLETED: {
    label: 'Pabeigts',
    icon: CheckCircle2,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  EXPIRED: {
    label: 'Beidzies',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

const POSITION_TYPE_LV: Record<FrameworkPositionType, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  WASTE_DISPOSAL: 'Atkritumu izvešana',
  FREIGHT_TRANSPORT: 'Kravu transportēšana',
};

const FILTER_OPTIONS: { key: 'ALL' | FrameworkContractStatus; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'ACTIVE', label: 'Aktīvie' },
  { key: 'COMPLETED', label: 'Pabeigti' },
  { key: 'EXPIRED', label: 'Beigušies' },
  { key: 'CANCELLED', label: 'Atceltie' },
];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Contract card ────────────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: ApiFrameworkContract }) {
  const cfg = STATUS_CFG[contract.status] ?? STATUS_CFG.ACTIVE;
  const StatusIcon = cfg.icon;
  const pct = Math.min(contract.totalProgressPct, 100);

  return (
    <Card className="group cursor-pointer relative overflow-hidden rounded-2xl bg-white transition-all hover:bg-slate-50/50 ring-1 ring-black/5 shadow-sm hover:ring-black/10 hover:shadow-md border-0 h-full flex flex-col">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">{contract.title}</CardTitle>
              <Badge className={`text-xs font-medium border ${cfg.className}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {cfg.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{contract.contractNumber}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(contract.startDate)} – {fmtDate(contract.endDate)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 px-5 pb-5 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Izpilde
            </span>
            <span className="font-semibold tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground/70 mt-1">
            <span>{contract.totalConsumedQty.toLocaleString('lv-LV')} patērēts</span>
            <span>{contract.totalAgreedQty.toLocaleString('lv-LV')} kopā</span>
          </div>
        </div>

        {/* Positions summary */}
        {contract.positions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contract.positions.map((pos) => {
              const posPct =
                pos.agreedQty > 0 ? Math.min((pos.consumedQty / pos.agreedQty) * 100, 100) : 0;
              return (
                <div
                  key={pos.id}
                  className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      {pos.materialName}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                      {POSITION_TYPE_LV[pos.positionType] ?? pos.positionType}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${posPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>
                      {pos.consumedQty} {pos.unit} / {pos.agreedQty} {pos.unit}
                    </span>
                    <span>
                      €{pos.unitPrice}/{pos.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground bg-slate-50/80 -mx-5 -mb-5 px-5 py-3 border-t border-black/5">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 opacity-70" />
            {contract.positions.length} pozīcijas
          </span>
          <span className="flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5 opacity-70" />
            {contract.totalCallOffs} izsaukumi
          </span>
          {contract.recentCallOffs.length > 0 && (
            <span className="text-muted-foreground">
              Pēdējais: {fmtDate(contract.recentCallOffs[0].createdAt)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FrameworkContractsPage() {
  const { token, user } = useAuth();
  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | FrameworkContractStatus>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getFrameworkContracts(token);
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate =
    !user?.company?.id || user.companyRole === 'OWNER' || user.companyRole === 'MANAGER';
  const filtered = filter === 'ALL' ? contracts : contracts.filter((c) => c.status === filter);

  return (
    <div className="w-full h-full pb-20 space-y-8">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 mb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ietvarlīgumi</h1>
          <p className="text-muted-foreground mt-1">
            Ilgtermiņa piegādes līgumi ar izsaukumu izsekošanu
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-0 sm:mr-1.5" />
            <span className="hidden sm:inline">Atjaunot</span>
          </Button>
          {canCreate && (
            <Button size="sm" disabled>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns līgums
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
              filter === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {label}
            {key !== 'ALL' && contracts.filter((c) => c.status === key).length > 0 && (
              <span className="ml-1.5 tabular-nums">
                {contracts.filter((c) => c.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="shadow-sm rounded-2xl border-0 ring-1 ring-black/5">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filter === 'ALL' ? 'Nav ietvarlīgumu' : 'Nav līgumu ar šo statusu'}
          description={
            filter === 'ALL'
              ? 'Ietvarlīgumi nodrošina fiksētas cenas ilgtermiņa piegādēm ar izsaukumiem'
              : undefined
          }
          action={
            filter === 'ALL' && canCreate ? (
              <Button disabled>
                <Plus className="h-4 w-4 mr-1.5" />
                Jauns līgums
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </div>
  );
}
