/**
 * Admin Config hub — /dashboard/admin/config
 * Tabbed hub: Piemaksas · Komisijas · SLA · Karodziņi
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Percent,
  Building2,
  Save,
  Search,
  Info,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import {
  adminGetPendingSurcharges,
  adminApproveSurcharge,
  adminRejectSurcharge,
  adminGetSlaOrders,
  adminGetSettings,
  adminUpdateSettings,
  adminGetCompanies,
  adminUpdateCompany,
  type AdminSurcharge,
  type SlaOrder,
  type AdminCompany,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}
function fmtDate(s: string) {
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(s));
}

// ─── Surcharges tab ───────────────────────────────────────────────────────────

const SURCHARGE_TYPE_LABEL: Record<string, string> = {
  WAITING_TIME: 'Gaidīšanas laiks',
  FUEL_SURCHARGE: 'Degvielas piemaksa',
  OVERWEIGHT: 'Pārslogošana',
  EXTRA_DISTANCE: 'Papildu attālums',
  CLEANING: 'Tīrīšana',
  OTHER: 'Cits',
};

function RejectModal({
  surcharge,
  onConfirm,
  onCancel,
}: {
  surcharge: AdminSurcharge;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">Noraidīt piemaksu</h2>
        <p className="text-sm text-muted-foreground">
          <strong>{surcharge.label}</strong> — {fmt(surcharge.amount, surcharge.currency)}
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Noraidīšanas iemesls</label>
          <textarea
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-24 resize-none"
            placeholder="Paskaidrojiet vadītājam, kāpēc piemaksa tika noraidīta..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Atcelt
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onConfirm(note)}
            disabled={!note.trim()}
          >
            Noraidīt
          </Button>
        </div>
      </div>
    </div>
  );
}

function SurchargesTab({ token }: { token: string }) {
  const [surcharges, setSurcharges] = useState<AdminSurcharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminSurcharge | null>(null);

  const fetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setSurcharges(await adminGetPendingSurcharges(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const totalExposure = surcharges.reduce((sum, s) => sum + (s.billable ? s.amount : 0), 0);

  const handleApprove = async (id: string) => {
    if (!token || processing) return;
    setProcessing(id + 'approve');
    try {
      await adminApproveSurcharge(id, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās apstiprināt');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    if (!token || processing) return;
    setRejectTarget(null);
    setProcessing(id + 'reject');
    try {
      await adminRejectSurcharge(id, note, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās noraidīt');
    } finally {
      setProcessing(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <>
      {rejectTarget && (
        <RejectModal
          surcharge={rejectTarget}
          onConfirm={(note) => handleReject(rejectTarget.id, note)}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      <div className="space-y-5 pt-4">
        <div className="flex justify-end">
          <button
            onClick={fetch}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-3.5" />
            Atjaunot
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Gaida apstiprināšanu
            </p>
            <p className="mt-1 text-3xl font-bold text-amber-800">{surcharges.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kopējā summa pircējiem
            </p>
            <p className="mt-1 text-3xl font-bold">{fmt(totalExposure)}</p>
          </div>
        </div>
        {surcharges.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nav gaidošu piemaksu"
            description="Visas iesniegtās piemaksas ir izskatītas."
          />
        ) : (
          <div className="space-y-3">
            {surcharges.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {SURCHARGE_TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    {!s.billable && (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                        Nav rēķināms pircējam
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">{s.label}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {s.order && (
                      <span>
                        Pasūtījums:{' '}
                        <Link
                          href={`/dashboard/admin/orders/${s.order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.order.orderNumber}
                        </Link>
                        {s.order.buyer && ` · ${s.order.buyer.name}`}
                      </span>
                    )}
                    {s.transportJob && (
                      <span>
                        Darbs: <span className="font-medium">{s.transportJob.jobNumber}</span>
                        {s.transportJob.driver &&
                          ` · ${s.transportJob.driver.firstName} ${s.transportJob.driver.lastName}`}
                      </span>
                    )}
                    <span>{fmtDate(s.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xl font-bold tabular-nums">
                    {fmt(s.amount, s.currency)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={!!processing}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Apstiprināt
                    </button>
                    <button
                      onClick={() => setRejectTarget(s)}
                      disabled={!!processing}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-sm font-semibold px-3 py-2 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Noraidīt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Fee config tab ───────────────────────────────────────────────────────────

const COMPANY_TYPE_LABEL: Record<string, string> = {
  CONSTRUCTION: 'Būvniecība',
  SUPPLIER: 'Piegādātājs',
  RECYCLER: 'Recycler',
  CARRIER: 'Pārvadātājs',
  HYBRID: 'Hybrid',
};

function CompanyRow({
  company,
  token,
  onSaved,
}: {
  company: AdminCompany;
  token: string;
  onSaved: (id: string, rate: number) => void;
}) {
  const defaultRate = company.commissionRate ?? 10;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(defaultRate));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const rate = parseFloat(draft);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    setBusy(true);
    try {
      await adminUpdateCompany(company.id, { commissionRate: rate }, token);
      onSaved(company.id, rate);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{company.name}</p>
          {company.legalName && company.legalName !== company.name && (
            <p className="text-xs text-muted-foreground">{company.legalName}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        {company.companyType && (
          <Badge variant="outline" className="text-xs">
            {COMPANY_TYPE_LABEL[company.companyType] ?? company.companyType}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${company.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
        >
          {company.verified ? 'Verificēts' : 'Nepārbaudīts'}
        </span>
      </TableCell>
      <TableCell className="w-40">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-7 w-20 text-sm"
              autoFocus
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        ) : (
          <span className="tabular-nums font-semibold text-sm">{defaultRate}%</span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={save}>
              <Save className="h-3 w-3 mr-1" />
              Saglabāt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => {
                setDraft(String(defaultRate));
                setEditing(false);
              }}
            >
              Atcelt
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                <span className="text-emerald-600">Saglabāts</span>
              </>
            ) : (
              'Rediģēt'
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function FeeConfigTab({ token }: { token: string }) {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setCompanies(await adminGetCompanies(token));
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = (id: string, rate: number) =>
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, commissionRate: rate } : c)));

  const visible = search.trim()
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.legalName?.toLowerCase().includes(search.toLowerCase()),
      )
    : companies;
  const avgRate =
    companies.length > 0
      ? companies.reduce((s, c) => s + (c.commissionRate ?? 10), 0) / companies.length
      : 0;
  const nonDefault = companies.filter(
    (c) => c.commissionRate !== null && c.commissionRate !== 10,
  ).length;

  return (
    <div className="space-y-5 pt-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Kā darbojas komisija</p>
              <p className="mt-1 text-blue-700">
                Noklusējuma likme: <strong>10%</strong>. Transporta pasūtījumiem —{' '}
                <strong>15%</strong>. Individuālās likmes aizstāj noklusējumu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Uzņēmumu skaits
            </p>
            <p className="mt-1 text-2xl font-bold">{companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vidējā likme
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{avgRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Individuālas likmes
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{nonDefault}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">atšķiras no noklusējuma</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Meklēt uzņēmumu..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Uzņēmumu komisijas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-none" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nav uzņēmumu"
              description="Neviens uzņēmums neatbilst meklēšanas kritērijiem."
              className="py-16"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uzņēmums</TableHead>
                  <TableHead>Tips</TableHead>
                  <TableHead>Verifikācija</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      Komisija
                    </div>
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <CompanyRow key={c.id} company={c} token={token} onSaved={handleSaved} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── SLA tab ──────────────────────────────────────────────────────────────────

function AgeBadge({ hours, status }: { hours: number; status: string }) {
  const isCritical =
    (status === 'PENDING' && hours >= 8) || (status === 'CONFIRMED' && hours >= 48);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
    >
      <Clock className="h-3 w-3" />
      {hours}h
    </span>
  );
}

const SLA_STATUS_LABEL: Record<string, string> = { PENDING: 'Gaida', CONFIRMED: 'Apstiprināts' };
const SLA_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
};

function SlaTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<SlaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setOrders(await adminGetSlaOrders(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const critical = orders.filter(
    (o) =>
      (o.status === 'PENDING' && o.ageHours >= 8) || (o.status === 'CONFIRMED' && o.ageHours >= 48),
  );
  const warning = orders.filter((o) => !critical.includes(o));

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-5 pt-4">
      <div className="flex justify-end">
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Atjaunot
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Kritiski (&gt;8h/48h)
          </p>
          <p className="mt-1 text-3xl font-bold text-red-700">{critical.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Brīdinājums (&gt;4h/24h)
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-700">{warning.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kopā
          </p>
          <p className="mt-1 text-3xl font-bold">{orders.length}</p>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          PENDING &gt; 4h brīdinājums
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          PENDING &gt; 8h kritisks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          CONFIRMED &gt; 24h brīdinājums
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          CONFIRMED &gt; 48h kritisks
        </span>
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Visi pasūtījumi ir SLA ietvaros"
          description="Nav neviena pasūtījuma, kas pārsniegtu reaģēšanas laika sliekšņus."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Nr.</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Statuss</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Vecums</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pircējs</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pilsēta</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Summa
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Transports</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const isCritical =
                    (o.status === 'PENDING' && o.ageHours >= 8) ||
                    (o.status === 'CONFIRMED' && o.ageHours >= 48);
                  return (
                    <tr
                      key={o.id}
                      className={`transition-colors ${isCritical ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-muted/20'}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-foreground/70">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SLA_STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {SLA_STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AgeBadge hours={o.ageHours} status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{o.buyer?.name ?? '—'}</p>
                        {o.buyer?.email && (
                          <p className="text-xs text-muted-foreground">{o.buyer.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.deliveryCity}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmt(o.total, o.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {o.transportJobs.length > 0 ? (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
                            {o.transportJobs.length} darb.
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nav</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/orders/${o.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {critical.length} kritiski · {warning.length} brīdinājums
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feature flags tab ────────────────────────────────────────────────────────

type FlagDef = { key: string; label: string; description: string; danger?: boolean };
type FlagGroup = { id: string; label: string; flags: FlagDef[] };

const FLAG_GROUPS: FlagGroup[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    flags: [
      {
        key: 'feature.materialOrders.enabled',
        label: 'Materiālu pasūtījumi',
        description: 'Ļauj pircējiem izveidot materiālu pasūtījumus no kataloga.',
      },
      {
        key: 'feature.transport.enabled',
        label: 'Transporta pasūtījumi',
        description: 'Ļauj pasūtīt pārvadājumus (bez materiālu pirkšanas).',
      },
      {
        key: 'feature.skipHire.enabled',
        label: 'Skip noma',
        description: 'Skip konteineru nomas modulis pircējiem un operatoriem.',
      },
      {
        key: 'feature.recycling.enabled',
        label: 'Utilizācija / Pieņemšana',
        description: 'Atkritumu un grunts utilizācijas plūsma recycler uzņēmumiem.',
      },
      {
        key: 'feature.rfq.enabled',
        label: 'Cenu pieprasījumi (RFQ)',
        description: 'Pircēji var nosūtīt cenu pieprasījumus piegādātājiem.',
      },
      {
        key: 'feature.guestCheckout.enabled',
        label: 'Guest checkout',
        description: 'Atļauj pasūtīt bez reģistrācijas (B2C homeowner plūsma).',
      },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B funkcijas',
    flags: [
      {
        key: 'feature.frameworkContracts.enabled',
        label: 'Ietvarlīgumi',
        description: 'Uzņēmumi var noslēgt ietvarlīgumus ar piegādātājiem.',
      },
      {
        key: 'feature.projectTracking.enabled',
        label: 'Projektu izmaksu uzskaite',
        description: 'Pasūtījumi var tikt saistīti ar projektiem un budžeta uzskaiti.',
      },
      {
        key: 'feature.teamManagement.enabled',
        label: 'Komandas pārvaldība',
        description: 'Uzņēmumu OWNER var pievienot darbiniekus un piešķirt tiesības.',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platforma',
    flags: [
      {
        key: 'feature.sellerApplications.enabled',
        label: 'Piegādātāju pieteikumi',
        description: 'Jauni piegādātāji var iesniegt pieteikumu platformā.',
      },
      {
        key: 'feature.carrierApplications.enabled',
        label: 'Pārvadātāju pieteikumi',
        description: 'Jauni pārvadātāji var iesniegt pieteikumu platformā.',
      },
      {
        key: 'feature.newRegistration.enabled',
        label: 'Jauna reģistrācija',
        description: 'Atļauj jauniem lietotājiem reģistrēties platformā.',
        danger: true,
      },
      {
        key: 'feature.b3Fields.enabled',
        label: 'B3 Fields (lauku punkti)',
        description: 'B3 lauku punktu modulis un svēršanas taloni.',
      },
      {
        key: 'feature.maintenance.enabled',
        label: 'Tehniskā apkope (maintenance mode)',
        description: 'Rāda apkopes ekrānu visiem lietotājiem.',
        danger: true,
      },
    ],
  },
];

function boolFlag(s: Record<string, string>, key: string): boolean {
  if (!(key in s)) return key !== 'feature.maintenance.enabled';
  return s[key] === 'true';
}
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function FeatureFlagsTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSettings(await adminGetSettings(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kļūda ielādējot iestatījumus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  function toggle(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: String(value) }));
    setPendingKeys((prev) => new Set(prev).add(key));
  }

  async function saveAll() {
    if (pendingKeys.size === 0) return;
    setSaveState('saving');
    const patch: Record<string, string> = {};
    for (const k of pendingKeys) patch[k] = settings[k] ?? 'false';
    try {
      const updated = await adminUpdateSettings(patch, token);
      setSettings(updated);
      setPendingKeys(new Set());
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (loadError)
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{loadError}</span>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Mēģināt vēlreiz
        </Button>
      </div>
    );

  const hasPending = pendingKeys.size > 0;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-end gap-3">
        {hasPending && (
          <span className="text-sm text-amber-600 font-medium">
            {pendingKeys.size} nesaglabātas izmaiņas
          </span>
        )}
        {saveState === 'saved' && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Saglabāts
          </span>
        )}
        {saveState === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            Kļūda
          </span>
        )}
        <Button onClick={saveAll} disabled={!hasPending || saveState === 'saving'} size="sm">
          {saveState === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Saglabāt izmaiņas
        </Button>
      </div>
      <div className="space-y-4">
        {FLAG_GROUPS.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-0">
              {group.flags.map((flag, idx) => {
                const enabled = boolFlag(settings, flag.key);
                const isDirty = pendingKeys.has(flag.key);
                return (
                  <div key={flag.key}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex items-start justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{flag.label}</span>
                          {flag.danger && (
                            <Badge variant="destructive" className="text-xs py-0 px-1.5">
                              Uzmanību
                            </Badge>
                          )}
                          {isDirty && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 text-amber-600 border-amber-300"
                            >
                              Nesaglabāts
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{flag.description}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-mono">{flag.key}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <span
                          className={`text-xs font-medium ${enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
                        >
                          {enabled ? 'Ieslēgts' : 'Atslēgts'}
                        </span>
                        <Switch checked={enabled} onCheckedChange={(v) => toggle(flag.key, v)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

function ConfigHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';
  const tab = searchParams.get('tab') ?? 'surcharges';

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Platformas konfigurācija"
        description="Piemaksas, komisijas, SLA monitorings un funkciju karodziņi"
      />
      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="surcharges">Piemaksas</TabsTrigger>
          <TabsTrigger value="fee-config">Komisijas</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="flags">Karodziņi</TabsTrigger>
        </TabsList>
        <TabsContent value="surcharges">
          <SurchargesTab token={token} />
        </TabsContent>
        <TabsContent value="fee-config">
          <FeeConfigTab token={token} />
        </TabsContent>
        <TabsContent value="sla">
          <SlaTab token={token} />
        </TabsContent>
        <TabsContent value="flags">
          <FeatureFlagsTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ConfigHubPage() {
  return (
    <Suspense>
      <ConfigHubContent />
    </Suspense>
  );
}
