/**
 * Admin — Piegādātāju & pārvadātāju vērtēšana
 * /dashboard/admin/scorecard
 *
 * Two tabs:
 *   Piegādātāji  — league table from adminGetSupplierPerformance
 *   Pārvadātāji  — CARRIER companies + transport jobs stats
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Truck, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminGetSupplierPerformance,
  adminGetCompanies,
  adminGetTransportJobs,
  type SupplierPerformance,
  type AdminCompany,
  type AdminTransportJob,
} from '@/lib/api/admin';

// ─── helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function pct(n: number) {
  return `${(n ?? 0).toFixed(1)}%`;
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function RateBadge({ rate }: { rate: number }) {
  const cls =
    rate >= 90
      ? 'bg-green-100 text-green-800'
      : rate >= 70
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  return (
    <Badge className={cls} variant="secondary">
      {pct(rate)}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const { token } = useAuth();

  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [transportJobs, setTransportJobs] = useState<AdminTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [sortBy, setSortBy] = useState<'completionRate' | 'gmv' | 'totalOrders'>('completionRate');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [suppRes, compRes, jobsRes] = await Promise.allSettled([
        adminGetSupplierPerformance(token),
        adminGetCompanies(token),
        adminGetTransportJobs(token),
      ]);
      if (suppRes.status === 'fulfilled') setSuppliers(suppRes.value);
      if (compRes.status === 'fulfilled') setCompanies(compRes.value);
      if (jobsRes.status === 'fulfilled') setTransportJobs(jobsRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Supplier list (filtered + sorted) ────────────────────────────────────────

  const filteredSuppliers = useMemo(() => {
    const q = supplierFilter.toLowerCase();
    return suppliers
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [suppliers, supplierFilter, sortBy]);

  const underperforming = suppliers.filter((s) => s.completionRate < 70).length;
  const avgCompletionRate =
    suppliers.length > 0
      ? suppliers.reduce((s, x) => s + x.completionRate, 0) / suppliers.length
      : 0;

  // ── Carrier stats derived from transport jobs ─────────────────────────────────

  const carrierStats = useMemo(() => {
    const carriers = companies.filter((c) => c.companyType === 'CARRIER');
    const jobsByCarrier: Record<string, { total: number; completed: number; revenue: number }> = {};
    for (const j of transportJobs) {
      if (!j.carrier) continue;
      const cid = j.carrier.id;
      if (!jobsByCarrier[cid]) jobsByCarrier[cid] = { total: 0, completed: 0, revenue: 0 };
      jobsByCarrier[cid].total += 1;
      if (j.status === 'COMPLETED') {
        jobsByCarrier[cid].completed += 1;
        jobsByCarrier[cid].revenue += j.rate ?? 0;
      }
    }
    return carriers
      .map((c) => {
        const stats = jobsByCarrier[c.id] ?? { total: 0, completed: 0, revenue: 0 };
        return {
          ...c,
          totalJobs: stats.total,
          completedJobs: stats.completed,
          completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
          revenue: stats.revenue,
        };
      })
      .sort((a, b) => b.totalJobs - a.totalJobs);
  }, [companies, transportJobs]);

  const filteredCarriers = useMemo(() => {
    const q = carrierFilter.toLowerCase();
    return carrierStats.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q),
    );
  }, [carrierStats, carrierFilter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dalībnieku vērtēšana"
        description="Piegādātāju un pārvadātāju darbības rādītāji"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Ielādē…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <Tabs defaultValue="suppliers">
          <TabsList>
            <TabsTrigger value="suppliers">Piegādātāji ({suppliers.length})</TabsTrigger>
            <TabsTrigger value="carriers">Pārvadātāji ({carrierStats.length})</TabsTrigger>
          </TabsList>

          {/* ── Suppliers tab ── */}
          <TabsContent value="suppliers" className="flex flex-col gap-4 pt-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Kopā piegādātāji
                      </p>
                      <p className="text-2xl font-bold">{suppliers.length}</p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Vid. izpildes rādītājs
                      </p>
                      <p className={`text-2xl font-bold ${rateColor(avgCompletionRate)}`}>
                        {pct(avgCompletionRate)}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-blue-500 mt-1" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Zemāk par 70%
                      </p>
                      <p
                        className={`text-2xl font-bold ${underperforming > 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                      >
                        {underperforming}
                      </p>
                    </div>
                    <XCircle
                      className={`h-5 w-5 mt-1 ${underperforming > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters + sort */}
            <div className="flex items-center gap-3">
              <Input
                placeholder="Meklēt piegādātāju…"
                className="max-w-xs"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Kārtot:
                {(['completionRate', 'gmv', 'totalOrders'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`px-2 py-1 rounded ${sortBy === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {key === 'completionRate' ? 'Izpilde' : key === 'gmv' ? 'GMV' : 'Pasūtījumi'}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Piegādātājs</TableHead>
                      <TableHead>Pilsēta</TableHead>
                      <TableHead className="text-right">Pasūtījumi</TableHead>
                      <TableHead className="text-right">Izpilde</TableHead>
                      <TableHead className="text-right">GMV</TableHead>
                      <TableHead className="text-right">Strīdi</TableHead>
                      <TableHead className="text-right">Listingi</TableHead>
                      <TableHead>Verif.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Nav datu
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredSuppliers.map((s, i) => (
                      <TableRow key={s.id} className={s.completionRate < 70 ? 'bg-red-50' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.city || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.totalOrders}</TableCell>
                        <TableCell className="text-right">
                          <RateBadge rate={s.completionRate} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{eur(s.gmv)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.openDisputes > 0 ? (
                            <span className="text-red-600 font-medium">{s.openDisputes}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.activeMaterials}
                        </TableCell>
                        <TableCell>
                          {s.verified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Carriers tab ── */}
          <TabsContent value="carriers" className="flex flex-col gap-4 pt-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Meklēt pārvadātāju…"
                className="max-w-xs"
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                {carrierStats.length} pārvadātāji · {transportJobs.length} darbi kopā
              </span>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Pārvadātājs</TableHead>
                      <TableHead>Pilsēta</TableHead>
                      <TableHead className="text-right">Darbi kopā</TableHead>
                      <TableHead className="text-right">Pabeigti</TableHead>
                      <TableHead className="text-right">Izpilde</TableHead>
                      <TableHead className="text-right">Ieņēmumi</TableHead>
                      <TableHead>Verif.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCarriers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nav pārvadātāju
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredCarriers.map((c, i) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.city || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.totalJobs}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.completedJobs}</TableCell>
                        <TableCell className="text-right">
                          {c.totalJobs > 0 ? (
                            <RateBadge rate={c.completionRate} />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{eur(c.revenue)}</TableCell>
                        <TableCell>
                          {c.verified ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
