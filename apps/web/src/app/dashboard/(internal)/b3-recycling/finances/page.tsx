/**
 * B3 Recycling — Finanses & Vide
 * /dashboard/b3-recycling/finances
 *
 * Three tabs:
 *   Ieņēmumi  — revenue by month/waste type derived from inbound jobs
 *   Vides rādītāji — CO₂ diversion, recovery rate, certified waste %
 *   APUS — compliance status from adminGetApusStats
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Leaf,
  Loader2,
  Recycle,
  Weight,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminGetRecyclingJobs,
  adminGetRecyclingWasteRecords,
  adminGetApusStats,
  adminGetApusRecords,
  type RecyclingInboundJob,
  type RecyclingWasteRecord,
  type ApusStats,
  type ApusWasteRecord,
} from '@/lib/api/admin';

// ─── helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function tonnes(n: number) {
  return `${n.toLocaleString('lv-LV', { maximumFractionDigits: 2 })} t`;
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('lv-LV', { month: 'short', year: 'numeric' });
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-foreground',
  bg = 'bg-muted',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  bg?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Revenue bar ──────────────────────────────────────────────────────────────

function RevenueBar({ value, max }: { value: number; max: number }) {
  const pctWidth = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${pctWidth}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">
        {eur(value)}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecyclingFinancesPage() {
  const { token } = useAuth();

  const [jobs, setJobs] = useState<RecyclingInboundJob[]>([]);
  const [records, setRecords] = useState<RecyclingWasteRecord[]>([]);
  const [apus, setApus] = useState<ApusStats | null>(null);
  const [apusRecords, setApusRecords] = useState<ApusWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, recordsRes, apusRes, apusRecsRes] = await Promise.allSettled([
        adminGetRecyclingJobs(token, { limit: 1000 }),
        adminGetRecyclingWasteRecords(token, { limit: 1000 }),
        adminGetApusStats(token),
        adminGetApusRecords(token),
      ]);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data);
      if (recordsRes.status === 'fulfilled') setRecords(recordsRes.value.data);
      if (apusRes.status === 'fulfilled') setApus(apusRes.value);
      if (apusRecsRes.status === 'fulfilled') setApusRecords(apusRecsRes.value.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Revenue by month ─────────────────────────────────────────────────────────

  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of jobs) {
      if (j.status === 'COMPLETED' || j.paymentStatus === 'PAID') {
        const key = monthKey(j.createdAt);
        map[key] = (map[key] ?? 0) + j.total;
      }
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);
  }, [jobs]);

  const maxMonthlyRevenue = Math.max(...revenueByMonth.map(([, v]) => v), 1);
  const totalRevenue = revenueByMonth.reduce((s, [, v]) => s + v, 0);

  // ── Revenue by waste type ────────────────────────────────────────────────────

  const revenueByType = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    for (const j of jobs) {
      if (j.status === 'COMPLETED' || j.paymentStatus === 'PAID') {
        const key = j.wasteTypes ?? 'Nav norādīts';
        if (!map[key]) map[key] = { revenue: 0, count: 0 };
        map[key].revenue += j.total;
        map[key].count += 1;
      }
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [jobs]);

  const maxTypeRevenue = Math.max(...revenueByType.map(([, v]) => v.revenue), 1);

  // ── Environmental metrics ────────────────────────────────────────────────────

  const totalWeightKg = records.reduce((s, r) => s + r.weight, 0);
  const totalRecyclableKg = records.reduce((s, r) => s + (r.recyclableWeight ?? 0), 0);
  const co2Diverted = (totalRecyclableKg / 1000) * 0.35;

  const recordsWithRate = records.filter((r) => r.recyclingRate != null);
  const avgRecoveryRate =
    recordsWithRate.length > 0
      ? recordsWithRate.reduce((s, r) => s + (r.recyclingRate ?? 0), 0) / recordsWithRate.length
      : 0;

  const certifiedCount = records.filter((r) => r.certificateUrl).length;
  const certifiedRate = records.length > 0 ? (certifiedCount / records.length) * 100 : 0;

  const materialListingsCreated = records.filter((r) => r.producedMaterialId).length;

  // ── Waste type breakdown ─────────────────────────────────────────────────────

  const wasteByType = useMemo(() => {
    const map: Record<string, { weight: number; recyclable: number; count: number }> = {};
    for (const r of records) {
      const key = r.wasteType;
      if (!map[key]) map[key] = { weight: 0, recyclable: 0, count: 0 };
      map[key].weight += r.weight;
      map[key].recyclable += r.recyclableWeight ?? 0;
      map[key].count += 1;
    }
    return Object.entries(map).sort(([, a], [, b]) => b.weight - a.weight);
  }, [records]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finanses & Vide"
        description="Ieņēmumi un vides rādītāji — B3 Recycling Gulbene"
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
        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Ieņēmumi</TabsTrigger>
            <TabsTrigger value="env">Vides rādītāji</TabsTrigger>
            <TabsTrigger value="apus">APUS</TabsTrigger>
          </TabsList>

          {/* ── Revenue tab ── */}
          <TabsContent value="revenue" className="flex flex-col gap-6 pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KpiCard
                label="Kopējie ieņēmumi"
                value={eur(totalRevenue)}
                sub={`${revenueByMonth.length} mēneši`}
                icon={BarChart3}
                color="text-teal-700"
                bg="bg-teal-50"
              />
              <KpiCard
                label="Pabeigti darbi"
                value={jobs.filter((j) => j.status === 'COMPLETED').length}
                sub={`No ${jobs.length} kopā`}
                icon={CheckCircle2}
                color="text-green-600"
                bg="bg-green-50"
              />
              <KpiCard
                label="Vidēji uz darbu"
                value={
                  jobs.filter((j) => j.status === 'COMPLETED').length > 0
                    ? eur(
                        jobs
                          .filter((j) => j.status === 'COMPLETED')
                          .reduce((s, j) => s + j.total, 0) /
                          jobs.filter((j) => j.status === 'COMPLETED').length,
                      )
                    : '—'
                }
                icon={BarChart3}
                color="text-blue-600"
                bg="bg-blue-50"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Ieņēmumi pa mēnešiem</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {revenueByMonth.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nav datu</p>
                )}
                {revenueByMonth.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {monthLabel(key)}
                    </span>
                    <RevenueBar value={value} max={maxMonthlyRevenue} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Ieņēmumi pēc atkritumu veida</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {revenueByType.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nav datu</p>
                )}
                {revenueByType.map(([type, data]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                      {type}
                    </span>
                    <RevenueBar value={data.revenue} max={maxTypeRevenue} />
                    <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                      ({data.count})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Environmental tab ── */}
          <TabsContent value="env" className="flex flex-col gap-6 pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KpiCard
                label="CO₂ novirzīts"
                value={`${co2Diverted.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`}
                sub="0.35 t CO₂/t pārstrādāts"
                icon={Leaf}
                color="text-green-600"
                bg="bg-green-50"
              />
              <KpiCard
                label="Vid. atgūšanas rādītājs"
                value={pct(avgRecoveryRate)}
                sub={`${recordsWithRate.length} ieraksti`}
                icon={Recycle}
                color="text-teal-600"
                bg="bg-teal-50"
              />
              <KpiCard
                label="Sertificēti ieraksti"
                value={`${certifiedRate.toFixed(0)}%`}
                sub={`${certifiedCount} no ${records.length}`}
                icon={CheckCircle2}
                color="text-blue-600"
                bg="bg-blue-50"
              />
              <KpiCard
                label="Pārstrādāts kopā"
                value={tonnes(totalRecyclableKg / 1000)}
                sub={`No ${tonnes(totalWeightKg / 1000)} pieņemts`}
                icon={Weight}
                color="text-amber-600"
                bg="bg-amber-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Circular economy chain */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Cirkulārā ekonomika</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pieņemts (kopā):</span>
                    <span className="font-medium">{tonnes(totalWeightKg / 1000)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pārstrādāts:</span>
                    <span className="font-medium text-green-600">
                      {tonnes(totalRecyclableKg / 1000)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materiālu listingi izveidoti:</span>
                    <span className="font-medium">{materialListingsCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CO₂ novirzīts:</span>
                    <span className="font-medium text-teal-600">{co2Diverted.toFixed(1)} t</span>
                  </div>
                </CardContent>
              </Card>

              {/* Waste type breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Atkritumu veidi</CardTitle>
                </CardHeader>
                <CardContent>
                  {wasteByType.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nav datu</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Veids</TableHead>
                          <TableHead className="text-right">Kopā (t)</TableHead>
                          <TableHead className="text-right">Pārstr. (t)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wasteByType.map(([type, data]) => (
                          <TableRow key={type}>
                            <TableCell className="text-xs">{type}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {(data.weight / 1000).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-green-600">
                              {(data.recyclable / 1000).toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── APUS tab ── */}
          <TabsContent value="apus" className="flex flex-col gap-6 pt-4">
            {apus && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label="Kopā ieraksti" value={apus.total} icon={BarChart3} bg="bg-muted" />
                <KpiCard
                  label="Iesniegti"
                  value={apus.submitted}
                  icon={CheckCircle2}
                  color="text-green-600"
                  bg="bg-green-50"
                />
                <KpiCard
                  label="Gaida"
                  value={apus.pending}
                  icon={Loader2}
                  color="text-amber-600"
                  bg="bg-amber-50"
                />
                <KpiCard
                  label="Noraidīti"
                  value={apus.rejected}
                  icon={XCircle}
                  color="text-red-600"
                  bg="bg-red-50"
                />
              </div>
            )}

            {apusRecords.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">APUS ieraksti</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atkritumu veids</TableHead>
                        <TableHead className="text-right">Svars (t)</TableHead>
                        <TableHead>Datums</TableHead>
                        <TableHead>Statuss</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apusRecords.slice(0, 50).map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="text-sm">{rec.wasteType}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {(rec.weight / 1000).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rec.processedDate
                              ? format(new Date(rec.processedDate), 'dd.MM.yyyy')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                rec.apusStatus === 'ACCEPTED'
                                  ? 'bg-green-100 text-green-800'
                                  : rec.apusStatus === 'REJECTED'
                                    ? 'bg-red-100 text-red-800'
                                    : rec.apusStatus === 'SUBMITTED'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-600'
                              }
                              variant="secondary"
                            >
                              {rec.apusStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nav APUS ierakstu
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
