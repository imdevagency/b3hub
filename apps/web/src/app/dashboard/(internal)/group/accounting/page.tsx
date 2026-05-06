'use client';

/**
 * /dashboard/group/accounting
 *
 * B3 Group — Grāmatvedības modulis
 * Manages integration with Jumis cloud accounting system (mansjumis.lv).
 *
 * Three sections:
 * 1. Savienojums  — Jumis credentials + connection test
 * 2. Sinhronizācija — push invoices / partners to Jumis + sync log
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  jumisGetSettings,
  jumisUpdateSettings,
  jumisTestConnection,
  jumisSyncData,
  jumisGetSyncLog,
  type JumisSettings,
  type JumisSyncLogEntry,
} from '@/lib/api/jumis';
import {
  adminGetFinanceStats,
  adminGetAllInvoices,
  type AdminFinanceStats,
  type AdminInvoice,
} from '@/lib/api/admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString('lv-LV', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', { dateStyle: 'short' });
}

function fmtEur(val: number) {
  return `€${val.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function actionLabel(action: string) {
  if (action.includes('INVOICE')) return 'Rēķinu sinhronizācija';
  if (action.includes('PARTNER')) return 'Partneru sinhronizācija';
  return action;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  SKIP_HIRE: 'Konteinera noma',
  DISPOSAL: 'Atkritumu izvešana',
  TOILET_CABIN: 'Tualetes kabīne',
  TRANSPORT: 'Transports',
  FRAMEWORK: 'Ietvarlīgums',
};

const INVOICE_STATUSES = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Neapmaksāti' },
  { value: 'PAID', label: 'Apmaksāti' },
  { value: 'OVERDUE', label: 'Kavēti' },
  { value: 'CANCELLED', label: 'Atcelti' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  current,
  previous,
  loading,
}: {
  title: string;
  value: string;
  current: number;
  previous: number;
  loading?: boolean;
}) {
  const pct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        {loading ? (
          <div className="mt-2 h-8 w-28 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        )}
        {!loading && pct !== null && (
          <p
            className={`mt-1 flex items-center gap-1 text-xs ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}
          >
            {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(pct).toFixed(1)}% pret pagājušo mēnesi
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    PAID: 'bg-green-100 text-green-800 hover:bg-green-100',
    OVERDUE: 'bg-red-100 text-red-800 hover:bg-red-100',
    CANCELLED: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
  };
  const labels: Record<string, string> = {
    PENDING: 'Gaida',
    PAID: 'Apmaksāts',
    OVERDUE: 'Kavēts',
    CANCELLED: 'Atcelts',
  };
  return (
    <Badge className={`text-xs font-medium ${cls[status] ?? ''}`}>{labels[status] ?? status}</Badge>
  );
}

// ─── Connection status pill ────────────────────────────────────────────────

function ConnectionBadge({ ok, testing }: { ok: boolean | null; testing: boolean }) {
  if (testing) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Pārbauda...
      </Badge>
    );
  }
  if (ok === null) return null;
  if (ok) {
    return (
      <Badge className="flex items-center gap-1 text-xs bg-green-100 text-green-800 hover:bg-green-100">
        <CheckCircle2 className="h-3 w-3" />
        Savienots
      </Badge>
    );
  }
  return (
    <Badge className="flex items-center gap-1 text-xs bg-red-100 text-red-800 hover:bg-red-100">
      <XCircle className="h-3 w-3" />
      Kļūda
    </Badge>
  );
}

// ─── Sync log row ─────────────────────────────────────────────────────────────

function SyncLogRow({ entry }: { entry: JumisSyncLogEntry }) {
  const pushed = entry.after?.pushed ?? 0;
  const success = entry.after?.success ?? false;

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5">
          {success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{actionLabel(entry.action)}</p>
          {success ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {pushed} ieraksti nosūtīti
              {entry.admin ? ` · ${entry.admin.firstName} ${entry.admin.lastName}` : ''}
            </p>
          ) : (
            <p className="text-xs text-red-500 mt-0.5 truncate max-w-sm">
              {entry.after?.error ?? 'Nezināma kļūda'}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-nowrap">{fmt(entry.createdAt)}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const { token } = useAuth();

  // Settings state
  const [settings, setSettings] = useState<JumisSettings | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Connection test state
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState('');

  // Sync state
  const [syncing, setSyncing] = useState<'invoices' | 'partners' | null>(null);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncLog, setSyncLog] = useState<JumisSyncLogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // Finance overview state
  const [stats, setStats] = useState<AdminFinanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Invoices state
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPages, setInvoicesPages] = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceStatus, setInvoiceStatus] = useState('ALL');

  // Load settings on mount
  useEffect(() => {
    if (!token) return;
    jumisGetSettings(token)
      .then((s) => {
        setSettings(s);
        setUsername(s.username);
        setDatabase(s.database);
        setEnabled(s.enabled);
      })
      .catch(() => {});
  }, [token]);

  const loadLog = useCallback(() => {
    if (!token) return;
    setLoadingLog(true);
    jumisGetSyncLog(token)
      .then(setSyncLog)
      .catch(() => {})
      .finally(() => setLoadingLog(false));
  }, [token]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    if (!token) return;
    setStatsLoading(true);
    adminGetFinanceStats(token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setInvoicesLoading(true);
    adminGetAllInvoices(token, invoicePage, 50, invoiceStatus !== 'ALL' ? invoiceStatus : undefined)
      .then((res) => {
        setInvoices(res.data);
        setInvoicesTotal(res.total);
        setInvoicesPages(res.pages);
      })
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }, [token, invoicePage, invoiceStatus]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveSettings() {
    if (!token) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await jumisUpdateSettings({ username, password, database, enabled }, token);
      setSettingsSaved(true);
      setPassword(''); // clear password field after save
      setSettings((prev) =>
        prev
          ? { ...prev, username, database, enabled, hasPassword: !!password || prev.hasPassword }
          : prev,
      );
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch {
      // error handled by apiFetch
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleTest() {
    if (!token) return;
    setTesting(true);
    setTestOk(null);
    setTestMessage('');
    try {
      const res = await jumisTestConnection(token);
      setTestOk(res.ok);
      setTestMessage(res.message);
    } catch (err) {
      setTestOk(false);
      setTestMessage(err instanceof Error ? err.message : 'Savienojuma kļūda');
    } finally {
      setTesting(false);
    }
  }

  async function handleSync(type: 'invoices' | 'partners') {
    if (!token) return;
    setSyncing(type);
    setSyncResult(null);
    try {
      const res = await jumisSyncData(type, token);
      setSyncResult(res);
      loadLog();
    } catch (err) {
      setSyncResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Sinhronizācija neizdevās',
      });
    } finally {
      setSyncing(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grāmatvedība"
        description="Jumis integrācija — sinhronizējiet B3Hub rēķinus un partnerus ar jūsu grāmatvedības sistēmu"
        action={
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://mansjumis.lv"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Jumis mājaslapa
            </a>
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Pārskats
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Rēķini
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Savienojums
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Sinhronizācija
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Žurnāls
          </TabsTrigger>
        </TabsList>

        {/* ── Pārskats ────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="GMV šomēnes"
              value={fmtEur(stats?.gmv.thisMonth ?? 0)}
              current={stats?.gmv.thisMonth ?? 0}
              previous={stats?.gmv.lastMonth ?? 0}
              loading={statsLoading}
            />
            <StatCard
              title="Komisija šomēnes"
              value={fmtEur(stats?.commission.thisMonth ?? 0)}
              current={stats?.commission.thisMonth ?? 0}
              previous={stats?.commission.lastMonth ?? 0}
              loading={statsLoading}
            />
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pasūtījumi šomēnes</p>
                {statsLoading ? (
                  <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {stats?.orders.thisMonth ?? 0}
                  </p>
                )}
                {!statsLoading && stats && stats.orders.lastMonth > 0 && (
                  <p
                    className={`mt-1 flex items-center gap-1 text-xs ${stats.orders.thisMonth >= stats.orders.lastMonth ? 'text-green-600' : 'text-red-500'}`}
                  >
                    {stats.orders.thisMonth >= stats.orders.lastMonth ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(
                      ((stats.orders.thisMonth - stats.orders.lastMonth) / stats.orders.lastMonth) *
                        100,
                    ).toFixed(1)}
                    % pret pagājušo mēnesi
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Gaida izmaksas</p>
                {statsLoading ? (
                  <div className="mt-2 h-8 w-28 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {fmtEur(stats?.pendingPayouts.total ?? 0)}
                  </p>
                )}
                {!statsLoading && stats && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.pendingPayouts.totalCount} maksājumi gaida izmaksu
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* All-time + by type */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visu laiku rādītāji</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kopējais GMV</span>
                  {statsLoading ? (
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className="font-medium">{fmtEur(stats?.gmv.allTime ?? 0)}</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kopējā komisija</span>
                  {statsLoading ? (
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className="font-medium">{fmtEur(stats?.commission.allTime ?? 0)}</span>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Piegādātāju gaida</span>
                  {statsLoading ? (
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className="font-medium">
                      {fmtEur(stats?.pendingPayouts.supplierAmount ?? 0)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({stats?.pendingPayouts.supplierCount ?? 0})
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pārvadātāju gaida</span>
                  {statsLoading ? (
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className="font-medium">
                      {fmtEur(stats?.pendingPayouts.carrierAmount ?? 0)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({stats?.pendingPayouts.carrierCount ?? 0})
                      </span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">GMV pēc pasūtījuma veida</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : !stats?.byOrderType.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nav datu</p>
                ) : (
                  <div className="space-y-2">
                    {stats.byOrderType
                      .sort((a, b) => b.gmv - a.gmv)
                      .map((row) => (
                        <div key={row.type} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground truncate">
                              {ORDER_TYPE_LABELS[row.type] ?? row.type}
                            </span>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {row.count}
                            </Badge>
                          </div>
                          <span className="font-medium shrink-0 ml-2">{fmtEur(row.gmv)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Rēķini ──────────────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="mt-6 space-y-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {INVOICE_STATUSES.map((s) => (
              <Button
                key={s.value}
                variant={invoiceStatus === s.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setInvoiceStatus(s.value);
                  setInvoicePage(1);
                }}
              >
                {s.label}
              </Button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground self-center">
              {invoicesTotal} rēķini kopā
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nav rēķinu šajā kategorijā</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Pircējs</TableHead>
                      <TableHead>Pasūtījums</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Termiņš</TableHead>
                      <TableHead>Apmaksāts</TableHead>
                      <TableHead>Datums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-sm">
                          {inv.buyerCompany?.name ?? inv.sellerCompany?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.order ? <span>#{inv.order.orderNumber}</span> : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtEur(inv.total)}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={inv.paymentStatus} />
                          {inv.isCommissionInvoice && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Komisija
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(inv.dueDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(inv.paidDate)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(inv.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {invoicesPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={invoicePage <= 1}
                onClick={() => setInvoicePage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Iepriekšējā
              </Button>
              <span className="text-sm text-muted-foreground">
                {invoicePage} / {invoicesPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={invoicePage >= invoicesPages}
                onClick={() => setInvoicePage((p) => p + 1)}
              >
                Nākamā
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Savienojums ─────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Credentials card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Jumis savienojuma dati</CardTitle>
                  <ConnectionBadge ok={testOk} testing={testing} />
                </div>
                <CardDescription>
                  Ievadiet Jumis mākoņa pieejas datus. Paroli iegūstiet Jumis vadības panelī sadaļā
                  &ldquo;Speciālā parole&rdquo;.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jumis-username">E-pasts (lietotājvārds)</Label>
                  <Input
                    id="jumis-username"
                    type="email"
                    placeholder="user@uznemums.lv"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumis-password">
                    SQL parole
                    {settings?.hasPassword && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        (saglabāta — atstājiet tukšu, lai nemainītu)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="jumis-password"
                    type="password"
                    placeholder={settings?.hasPassword ? '••••••••' : 'SQL parole no Jumis'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    <a
                      href="https://atbalsts.mansjumis.lv/hc/lv/articles/360026728513"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Kā iegūt SQL paroli?
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumis-database">Datubāzes nosaukums</Label>
                  <Input
                    id="jumis-database"
                    placeholder="datubaze"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    <a
                      href="https://atbalsts.mansjumis.lv/hc/lv/articles/8977682517522"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Kā noskaidrot datubāzes nosaukumu?
                    </a>
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Integrācija aktīva</p>
                    <p className="text-xs text-muted-foreground">
                      Atslēdziet, lai īslaicīgi apturētu sinhronizāciju
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings || (!username && !database)}
                    className="flex-1"
                  >
                    {savingSettings ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {settingsSaved ? 'Saglabāts!' : 'Saglabāt'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing || !settings?.hasPassword}
                    title={!settings?.hasPassword ? 'Vispirms saglabājiet iestatījumus' : ''}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {testMessage && (
                  <div
                    className={`mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                      testOk
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {testOk ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>{testMessage}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* About card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Par Jumis integrāciju</CardTitle>
                <CardDescription>Kas tiek sinhronizēts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Rēķini</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      B3Hub rēķini tiek eksportēti uz Jumis kā finanšu dokumenti. Katrs rēķins satur
                      partnera nosaukumu, summu (EUR) un datumu.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Partneri</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      B3Hub uzņēmumi (pircēji, piegādātāji) tiek eksportēti kā Jumis partneru
                      kartītes ar reģistrācijas numuru un adresi.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Drošība</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Savienojums notiek caur Jumis REST API ar SSL šifrēšanu. Parole tiek šifrēti
                      glabāta platformas iestatījumos.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Jumis REST API</p>
                  <p>Jumis ir Visma Group produkts Latvijā. Plašāka dokumentācija:</p>
                  <a
                    href="https://atbalsts.mansjumis.lv/hc/lv/articles/6482469051922"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 underline"
                  >
                    Jumis REST API specifikācija
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Sinhronizācija ───────────────────────────────────────────────── */}
        <TabsContent value="sync" className="mt-6 space-y-6">
          {!settings?.enabled && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800">
              <WifiOff className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Jumis integrācija nav iespējota. Iespējojiet to sadaļā <strong>Savienojums</strong>{' '}
                un saglabājiet iestatījumus.
              </span>
            </div>
          )}

          {syncResult && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
                syncResult.ok
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {syncResult.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{syncResult.message}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Rēķini
                </CardTitle>
                <CardDescription>
                  Eksportē visus B3Hub rēķinus uz Jumis kā finanšu dokumentus
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Sinhronizē platformas rēķinus — grāmatvedim tie parādīsies Jumis sadaļā{' '}
                  <em>Finanšu dokumenti</em>.
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleSync('invoices')}
                  disabled={!!syncing || !settings?.enabled}
                >
                  {syncing === 'invoices' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Sinhronizēt rēķinus
                </Button>
              </CardContent>
            </Card>

            {/* Partners */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Partneri
                </CardTitle>
                <CardDescription>
                  Eksportē B3Hub uzņēmumus uz Jumis kā partneru kartītes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Sinhronizē reģistrētos B3Hub uzņēmumus ar rekvizītiem — Jumis sadaļā{' '}
                  <em>Partneri</em>.
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSync('partners')}
                  disabled={!!syncing || !settings?.enabled}
                >
                  {syncing === 'partners' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Sinhronizēt partnerus
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Pēdējie sinhronizācijas rezultāti
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLog ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncLog.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sinhronizācija vēl nav veikta
                </p>
              ) : (
                <div>
                  {syncLog.slice(0, 5).map((e) => (
                    <SyncLogRow key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Žurnāls ─────────────────────────────────────────────────────── */}
        <TabsContent value="log" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Sinhronizācijas žurnāls</CardTitle>
                  <CardDescription>Pēdējās 100 sinhronizācijas darbības</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={loadLog} disabled={loadingLog}>
                  <RefreshCw className={`h-4 w-4 ${loadingLog ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLog ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Sinhronizācijas ierakstu nav</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Veiciet pirmo sinhronizāciju sadaļā &ldquo;Sinhronizācija&rdquo;
                  </p>
                </div>
              ) : (
                <div>
                  {syncLog.map((e) => (
                    <SyncLogRow key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
