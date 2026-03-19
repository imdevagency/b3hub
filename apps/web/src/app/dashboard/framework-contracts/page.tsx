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
import { PageHeader } from '@/components/ui/page-header';
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

const STATUS_CFG: Record<FrameworkContractStatus, { label: string; icon: React.ElementType; className: string }> = {
  ACTIVE:    { label: 'Aktīvs',    icon: CheckCircle2, className: 'bg-green-100 text-green-800 border-green-200' },
  COMPLETED: { label: 'Pabeigts', icon: CheckCircle2, className: 'bg-blue-100 text-blue-800 border-blue-200' },
  EXPIRED:   { label: 'Beidzies', icon: Clock,        className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CANCELLED: { label: 'Atcelts',  icon: XCircle,      className: 'bg-red-100 text-red-800 border-red-200' },
};

const POSITION_TYPE_LV: Record<FrameworkPositionType, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  WASTE_DISPOSAL:    'Atkritumu izvešana',
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
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Contract card ────────────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: ApiFrameworkContract }) {
  const cfg = STATUS_CFG[contract.status] ?? STATUS_CFG.ACTIVE;
  const StatusIcon = cfg.icon;
  const pct = Math.min(contract.totalProgressPct, 100);

  return (
    <Card className="shadow-none border-border/60 hover:border-border transition-colors">
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

      <CardContent className="px-5 pb-5 space-y-4">
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
              const posPct = pos.agreedQty > 0 ? Math.min((pos.consumedQty / pos.agreedQty) * 100, 100) : 0;
              return (
                <div key={pos.id} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
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
                    <span>{pos.consumedQty} {pos.unit} / {pos.agreedQty} {pos.unit}</span>
                    <span>€{pos.unitPrice}/{pos.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 pt-1 border-t border-border/40 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {contract.positions.length} pozīcijas
          </span>
          <span className="flex items-center gap-1">
            <ScrollText className="h-3.5 w-3.5" />
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

  useEffect(() => { load(); }, [load]);

  const canCreate = !user?.company?.id || user.companyRole === 'OWNER' || user.companyRole === 'MANAGER';
  const filtered = filter === 'ALL' ? contracts : contracts.filter((c) => c.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ietvarlīgumi"
        description="Ilgtermiņa piegādes līgumi ar izsaukumu izsekošanu"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atjaunot
            </Button>
            {canCreate && (
              <Button size="sm" disabled>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Jauns līgums
              </Button>
            )}
          </div>
        }
      />

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
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="grid grid-cols-2 gap-2">
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
        <div className="space-y-4">
          {filtered.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </div>
      )}
    </div>
  );
}
