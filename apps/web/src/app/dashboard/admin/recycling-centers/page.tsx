/**
 * Admin recycling centers page — /dashboard/admin/recycling-centers
 * Platform-wide view of all registered waste processing facilities.
 * Admin can activate / deactivate centers and review throughput (waste records).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetRecyclingCenters,
  adminToggleRecyclingCenter,
  type AdminRecyclingCenter,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Recycle, Search, CheckCircle2, XCircle } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  SOIL: 'Grunts',
  ASPHALT: 'Asfalta',
  BRICK: 'Ķieģeļi',
  MIXED: 'Jaukti',
  METAL: 'Metāls',
  WOOD: 'Koksne',
  GLASS: 'Stikls',
  PLASTIC: 'Plastmasa',
  ORGANIC: 'Organika',
  HAZARDOUS: 'Bīstami',
};

// ─── Row ──────────────────────────────────────────────────────────────────────

function CenterRow({
  center,
  token,
  onToggled,
}: {
  center: AdminRecyclingCenter;
  token: string;
  onToggled: (id: string, active: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await adminToggleRecyclingCenter(center.id, !center.active, token);
      onToggled(center.id, !center.active);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {center.active ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <div>
            <p className="font-medium text-sm">{center.name}</p>
            <p className="text-xs text-muted-foreground">
              {center.address}, {center.city}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm">{center.company.name}</p>
        <p className="text-xs text-muted-foreground">{center.company.city}</p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {center.acceptedWasteTypes.slice(0, 4).map((wt) => (
            <Badge key={wt} variant="outline" className="text-xs px-1.5 py-0">
              {WASTE_LABELS[wt] ?? wt}
            </Badge>
          ))}
          {center.acceptedWasteTypes.length > 4 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{center.acceptedWasteTypes.length - 4}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-right">
        {center.capacity.toLocaleString('lv-LV')} t/d
      </TableCell>
      <TableCell className="text-sm text-right font-medium">
        {center._count.wasteRecords.toLocaleString('lv-LV')}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-muted-foreground">
            {center.active ? 'Aktīvs' : 'Neaktīvs'}
          </span>
          <Switch
            checked={center.active}
            onCheckedChange={toggle}
            disabled={busy}
            aria-label="Toggle recycling center active"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRecyclingCentersPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [rows, setRows] = useState<AdminRecyclingCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hideInactive, setHideInactive] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetRecyclingCenters(token);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const filtered = rows.filter((r) => {
    if (hideInactive && !r.active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.company.name.toLowerCase().includes(q)
    );
  });

  const total = rows.length;
  const active = rows.filter((r) => r.active).length;
  const totalCapacity = rows.filter((r) => r.active).reduce((s, r) => s + r.capacity, 0);
  const totalRecords = rows.reduce((s, r) => s + r._count.wasteRecords, 0);

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizācijas centri"
        description="Atkritumu pieņemšanas un apstrādes centri. Pievieno, aktivizē, deaktivizē objektus."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Kopā centri', value: total, color: 'text-foreground' },
          { label: 'Aktīvi', value: active, color: 'text-green-600' },
          {
            label: 'Jauda (aktīvi)',
            value: `${totalCapacity.toLocaleString('lv-LV')} t/d`,
            color: 'text-blue-600',
          },
          {
            label: 'Atkritumu ieraksti',
            value: totalRecords.toLocaleString('lv-LV'),
            color: 'text-purple-600',
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Meklēt nosaukumu, pilsētu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Switch
            checked={hideInactive}
            onCheckedChange={setHideInactive}
            aria-label="Hide inactive centers"
          />
          Slēpt neaktīvos
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Recycle}
          title="Nav utilizācijas centru"
          description="Piegādātāji var reģistrēt centrus no sava konta iestatījumiem."
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centrs</TableHead>
                <TableHead>Uzņēmums</TableHead>
                <TableHead>Pieņemtie atkritumi</TableHead>
                <TableHead className="text-right">Jauda</TableHead>
                <TableHead className="text-right">Ieraksti</TableHead>
                <TableHead className="text-right">Statuss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((center) => (
                <CenterRow
                  key={center.id}
                  center={center}
                  token={token}
                  onToggled={(id, active) =>
                    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)))
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
