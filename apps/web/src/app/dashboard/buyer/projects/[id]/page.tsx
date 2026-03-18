'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getFrameworkContract,
  createFrameworkCallOff,
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type ApiFrameworkCallOff,
  type FrameworkContractStatus,
} from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  CalendarDays,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_META: Record<
  FrameworkContractStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  ACTIVE: { label: 'Aktīvs', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  EXPIRED: { label: 'Beidzies', variant: 'outline' },
  CANCELLED: { label: 'Atcelts', variant: 'destructive' },
};

const POS_TYPE_LABEL: Record<string, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  WASTE_DISPOSAL: 'Atkritumu izvešana',
  FREIGHT_TRANSPORT: 'Kravas transports',
};

const CALLOFF_STATUS_CFG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  DELIVERED: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Piegādāts' },
  COMPLETED: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Pabeigts' },
  IN_TRANSIT: { icon: Truck, color: 'text-blue-600', label: 'Ceļā' },
  DEFAULT: { icon: Clock, color: 'text-amber-600', label: 'Gaida' },
};

function getCallOffCfg(status: string) {
  const upper = status.toUpperCase();
  return CALLOFF_STATUS_CFG[upper] ?? CALLOFF_STATUS_CFG.DEFAULT;
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function CallOffRow({ item }: { item: ApiFrameworkCallOff }) {
  const cfg = getCallOffCfg(item.status);
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 ${cfg.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">#{item.callOffNumber}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {cfg.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.requestedQty} vienības · {fmtDate(item.scheduledDate)}
          {item.notes ? ` · ${item.notes}` : ''}
        </p>
      </div>
    </div>
  );
}

function PositionCard({
  position,
  onRelease,
}: {
  position: ApiFrameworkPosition;
  onRelease: (pos: ApiFrameworkPosition) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = position.agreedQty > 0 ? (position.consumedQty / position.agreedQty) * 100 : 0;
  const remaining = Math.max(0, position.agreedQty - position.consumedQty);

  return (
    <Card className="shadow-none border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {POS_TYPE_LABEL[position.positionType] ?? position.positionType}
              </span>
            </div>
            <p className="text-sm font-semibold">{position.materialName}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 text-xs"
            onClick={() => onRelease(position)}
          >
            <Plus className="h-3 w-3 mr-1" /> Atsaukšana
          </Button>
        </div>

        {/* progress */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {position.consumedQty.toFixed(1)} / {position.agreedQty.toFixed(1)} {position.unit}
            </span>
            <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
          </div>
          <ProgressBar pct={pct} />
        </div>

        {/* meta row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
          <span>
            Atlikums:{' '}
            <span className="text-foreground font-medium">
              {remaining.toFixed(1)} {position.unit}
            </span>
          </span>
          <span>
            Cena:{' '}
            <span className="text-foreground font-medium">
              €{position.unitPrice.toFixed(2)}/{position.unit}
            </span>
          </span>
          {position.pickupAddress && (
            <span className="truncate max-w-[160px]">No: {position.pickupAddress}</span>
          )}
          {position.deliveryAddress && (
            <span className="truncate max-w-[160px]">Uz: {position.deliveryAddress}</span>
          )}
        </div>

        {/* call-offs toggle */}
        {position.callOffs.length > 0 && (
          <>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {position.callOffs.length} atsaukšanas
            </button>
            {expanded && (
              <div className="mt-2 pl-1">
                {position.callOffs.map((co) => (
                  <CallOffRow key={co.id} item={co} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── release call-off dialog ──────────────────────────────────────────────────

function ReleaseCallOffDialog({
  open,
  position,
  onClose,
  onSubmit,
}: {
  open: boolean;
  position: ApiFrameworkPosition | null;
  onClose: () => void;
  onSubmit: (qty: number, date: string, notes: string) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setSaving(true);
    try {
      await onSubmit(q, date, notes);
      setQty('');
      setDate('');
      setNotes('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remaining = position ? Math.max(0, position.agreedQty - position.consumedQty) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atsaukšanas darba uzdevums</DialogTitle>
        </DialogHeader>
        {position && (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{position.materialName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atlikums: {remaining.toFixed(1)} {position.unit}
              </p>
            </div>

            <div>
              <Label>Daudzums ({position.unit}) *</Label>
              <Input
                type="number"
                className="mt-1"
                placeholder={`Max ${remaining.toFixed(1)}`}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min={0}
                max={remaining}
              />
            </div>

            <div>
              <Label>Ieplānotais datums</Label>
              <Input
                type="date"
                className="mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Piezīmes</Label>
              <Textarea
                rows={2}
                className="mt-1"
                placeholder="Papildinformācija..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Atcelt
              </Button>
              <Button onClick={handleSubmit} disabled={!qty || parseFloat(qty) <= 0 || saving}>
                {saving ? 'Sūta...' : 'Apstiprināt'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function BuyerProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasePos, setReleasePos] = useState<ApiFrameworkPosition | null>(null);

  const load = useCallback(
    async (showRefresh = false) => {
      if (!token || !id) return;
      if (showRefresh) setRefreshing(true);
      try {
        const data = await getFrameworkContract(id, token);
        setContract(data);
      } catch {
        router.push('/dashboard/buyer/projects');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id, router],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRelease = async (qty: number, date: string, notes: string) => {
    if (!token || !contract || !releasePos) return;
    await createFrameworkCallOff(
      contract.id,
      releasePos.id,
      {
        requestedQty: qty,
        scheduledDate: date || undefined,
        notes: notes || undefined,
      },
      token,
    );
    await load();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const meta = STATUS_META[contract.status];

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* back + header */}
      <div>
        <Link
          href="/dashboard/buyer/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ uz rāmjlīgumiem
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{contract.contractNumber}</p>
            <h1 className="text-2xl font-bold mt-0.5">{contract.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* summary card */}
      <Card className="shadow-none border-border/50">
        <CardContent className="p-5">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kopējā izpilde</span>
              <span className="font-semibold">{(contract.totalProgressPct ?? 0).toFixed(0)}%</span>
            </div>
            <ProgressBar pct={contract.totalProgressPct ?? 0} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)}
              </span>
              <span>{contract.totalCallOffs} atsaukšanas</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-t border-border pt-4">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
            </span>
            <span>{contract.positions.length} pozīcijas</span>
            {contract.notes && <span className="text-foreground">{contract.notes}</span>}
          </div>
        </CardContent>
      </Card>

      {/* positions */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Pozīcijas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {contract.positions.map((pos) => (
            <PositionCard key={pos.id} position={pos} onRelease={setReleasePos} />
          ))}
        </div>
      </section>

      {/* recent call-offs summary */}
      {contract.recentCallOffs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Pēdējās atsaukšanas
          </h2>
          <Card className="shadow-none border-border/50">
            <CardContent className="p-4">
              {contract.recentCallOffs.map((co) => (
                <CallOffRow key={co.id} item={co} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <ReleaseCallOffDialog
        open={!!releasePos}
        position={releasePos}
        onClose={() => setReleasePos(null)}
        onSubmit={handleRelease}
      />
    </div>
  );
}
