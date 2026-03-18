/**
 * Buyer projects list — /dashboard/buyer/projects
 * Lists all procurement projects/quote requests created by the buyer.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getFrameworkContracts,
  createFrameworkContract,
  type ApiFrameworkContract,
  type FrameworkContractStatus,
  type FrameworkPositionType,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ChevronRight, RefreshCw, Layers, CalendarDays, Package } from 'lucide-react';
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

const POS_TYPE_OPTIONS: { value: FrameworkPositionType; label: string }[] = [
  { value: 'MATERIAL_DELIVERY', label: 'Materiālu piegāde' },
  { value: 'WASTE_DISPOSAL', label: 'Atkritumu izvešana' },
  { value: 'FREIGHT_TRANSPORT', label: 'Kravas transports' },
];

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ContractCard({ contract }: { contract: ApiFrameworkContract }) {
  const meta = STATUS_META[contract.status];
  const pct = contract.totalProgressPct ?? 0;
  return (
    <Link href={`/dashboard/buyer/projects/${contract.id}`}>
      <Card className="shadow-none border-border/50 hover:border-border hover:shadow-sm transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">{contract.contractNumber}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 truncate group-hover:text-primary transition-colors">
                {contract.title}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={meta.variant} className="text-[10px] h-5">
                {meta.label}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Izpilde</span>
              <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
            </div>
            <ProgressBar pct={pct} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)}
              </span>
              <span>{contract.totalCallOffs} pasūtījumi</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {contract.positions.length} pozīcijas
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── create contract dialog ────────────────────────────────────────────────────

interface NewPosition {
  positionType: FrameworkPositionType;
  materialName: string;
  unit: string;
  agreedQty: string;
  unitPrice: string;
  pickupAddress: string;
  deliveryAddress: string;
}

const emptyPosition = (): NewPosition => ({
  positionType: 'MATERIAL_DELIVERY',
  materialName: '',
  unit: 't',
  agreedQty: '',
  unitPrice: '',
  pickupAddress: '',
  deliveryAddress: '',
});

function CreateContractDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    startDate: string;
    endDate: string;
    notes: string;
    positions: NewPosition[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [positions, setPositions] = useState<NewPosition[]>([emptyPosition()]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({ title, startDate, endDate, notes, positions });
      setTitle('');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setPositions([emptyPosition()]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const updatePos = (i: number, field: keyof NewPosition, value: string) => {
    setPositions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jauns Rāmjlīgums</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Nosaukums *</Label>
            <Input
              className="mt-1"
              placeholder="Rāmjlīguma nosaukums"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sākuma datums</Label>
              <Input
                type="date"
                className="mt-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Beigu datums</Label>
              <Input
                type="date"
                className="mt-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Piezīmes</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Papildu informācija..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* positions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Pozīcijas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPositions((p) => [...p, emptyPosition()])}
              >
                <Plus className="h-3 w-3 mr-1" /> Pievienot
              </Button>
            </div>
            {positions.map((pos, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pozīcija {i + 1}
                  </span>
                  {positions.length > 1 && (
                    <button
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setPositions((p) => p.filter((_, idx) => idx !== i))}
                    >
                      Dzēst
                    </button>
                  )}
                </div>

                <Select
                  value={pos.positionType}
                  onValueChange={(v) => updatePos(i, 'positionType', v as FrameworkPositionType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <Input
                      placeholder="Materiāls"
                      className="h-8 text-xs"
                      value={pos.materialName}
                      onChange={(e) => updatePos(i, 'materialName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Vienība (t, m³)"
                      className="h-8 text-xs"
                      value={pos.unit}
                      onChange={(e) => updatePos(i, 'unit', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Daudzums"
                      className="h-8 text-xs"
                      value={pos.agreedQty}
                      onChange={(e) => updatePos(i, 'agreedQty', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="No (adrese)"
                    className="h-8 text-xs"
                    value={pos.pickupAddress}
                    onChange={(e) => updatePos(i, 'pickupAddress', e.target.value)}
                  />
                  <Input
                    placeholder="Uz (adrese)"
                    className="h-8 text-xs"
                    value={pos.deliveryAddress}
                    onChange={(e) => updatePos(i, 'deliveryAddress', e.target.value)}
                  />
                </div>

                <Input
                  type="number"
                  placeholder="Cena par vienību (€)"
                  className="h-8 text-xs"
                  value={pos.unitPrice}
                  onChange={(e) => updatePos(i, 'unitPrice', e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Atcelt
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
              {saving ? 'Saglabā...' : 'Izveidot'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function BuyerProjectsPage() {
  const { token } = useAuth();
  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = async (showRefresh = false) => {
    if (!token) return;
    if (showRefresh) setRefreshing(true);
    try {
      const data = await getFrameworkContracts(token);
      setContracts(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (form: {
    title: string;
    startDate: string;
    endDate: string;
    notes: string;
    positions: {
      positionType: FrameworkPositionType;
      materialName: string;
      unit: string;
      agreedQty: string;
      unitPrice: string;
      pickupAddress: string;
      deliveryAddress: string;
    }[];
  }) => {
    if (!token) return;
    const created = await createFrameworkContract(
      {
        title: form.title,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        notes: form.notes || undefined,
        positions: form.positions.map((p) => ({
          positionType: p.positionType,
          materialName: p.materialName,
          unit: p.unit,
          agreedQty: parseFloat(p.agreedQty) || 0,
          unitPrice: parseFloat(p.unitPrice) || 0,
          pickupAddress: p.pickupAddress || undefined,
          deliveryAddress: p.deliveryAddress || undefined,
        })),
      },
      token,
    );
    setContracts((prev) => [created, ...prev]);
  };

  const active = contracts.filter((c) => c.status === 'ACTIVE');
  const rest = contracts.filter((c) => c.status !== 'ACTIVE');

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rāmjlīgumi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ilgtermiņa piegādes līgumi ar atsaukšanas darba uzdevumiem
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Jauns līgums
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Nav rāmjlīgumu</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Izveidojiet pirmo rāmjlīgumu, lai pārvaldītu ilgtermiņa piegādes
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Jauns rāmjlīgums
          </Button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Aktīvie
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((c) => (
                  <ContractCard key={c.id} contract={c} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Citi
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {rest.map((c) => (
                  <ContractCard key={c.id} contract={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <CreateContractDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
