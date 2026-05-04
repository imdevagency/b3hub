/**
 * B3 Construction — Profitability Summary
 * /dashboard/b3-construction/profitability
 *
 * Replaces the monthly "Pašizmaksa" spreadsheet tabs.
 * contractValue = invoiced amount (what client pays)
 * dprCost       = actual self-cost from Daily Production Reports
 * grossMargin   = contractValue − dprCost
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Filter, Download } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminGetConstructionProfitability,
  adminGetConstructionProjects,
  type ConstructionProfitabilityResponse,
  type ProjectProfitabilitySummary,
  type AdminConstructionProject,
  type CostCode,
} from '@/lib/api/admin';

const COST_CODE_LABELS: Record<CostCode, string> = {
  LABOUR: 'Darbs',
  EQUIPMENT: 'Tehnika',
  MATERIAL: 'Materiāls',
  TRANSPORT: 'Transports',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OTHER: 'Cits',
};

const COST_CODE_COLORS: Record<CostCode, string> = {
  LABOUR: 'bg-blue-500',
  EQUIPMENT: 'bg-orange-500',
  MATERIAL: 'bg-green-500',
  TRANSPORT: 'bg-purple-500',
  SUBCONTRACTOR: 'bg-pink-500',
  OTHER: 'bg-gray-400',
};

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mai',
  '06': 'Jūn',
  '07': 'Jūl',
  '08': 'Aug',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Dec',
};

function fmtEur(n: number) {
  return `€${n.toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function MarginBadge({ pct }: { pct: number }) {
  if (pct >= 15)
    return (
      <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
        <TrendingUp className="h-3.5 w-3.5" />
        {pct.toFixed(1)}%
      </span>
    );
  if (pct >= 0)
    return (
      <span className="inline-flex items-center gap-1 text-yellow-700 font-semibold">
        <Minus className="h-3.5 w-3.5" />
        {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
      <TrendingDown className="h-3.5 w-3.5" />
      {pct.toFixed(1)}%
    </span>
  );
}

export default function ProfitabilityPage() {
  const { token } = useAuth();

  const [data, setData] = useState<ConstructionProfitabilityResponse | null>(null);
  const [projects, setProjects] = useState<AdminConstructionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [profRes, projRes] = await Promise.all([
        adminGetConstructionProfitability(token, {
          projectId: filterProject || undefined,
          from: filterFrom || undefined,
          to: filterTo || undefined,
        }),
        adminGetConstructionProjects(token, { limit: 200 }),
      ]);
      setData(profRes);
      setProjects(projRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token, filterProject, filterFrom, filterTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals;
  const costBreakdown = data?.costBreakdown ?? {};
  const totalCost = Object.values(costBreakdown).reduce((s, v) => s + (v ?? 0), 0);

  // Monthly chart — normalize to max bar width 100%
  const monthlyCosts = data?.monthlyCosts ?? [];
  const maxMonthCost = Math.max(...monthlyCosts.map((m) => m.cost), 1);

  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [
      [
        'Projekts',
        'Klients',
        'Statuss',
        'Līguma vērtība (€)',
        'DPR izmaksas (€)',
        'Bruto peļņa (€)',
        'Marža (%)',
      ],
    ];
    for (const p of data.projects) {
      rows.push([
        p.name,
        p.clientName ?? '',
        p.status,
        p.contractValue.toFixed(2),
        p.dprCost.toFixed(2),
        p.grossMargin.toFixed(2),
        p.marginPct.toFixed(2),
      ]);
    }
    if (totals) {
      rows.push([
        'KOPĀ',
        '',
        '',
        totals.contractValue.toFixed(2),
        totals.dprCost.toFixed(2),
        totals.grossMargin.toFixed(2),
        totals.marginPct.toFixed(2),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentabilitate_${filterFrom}_${filterTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rentabilitāte"
        description="Līguma vērtība (ienākumi) vs DPR pašizmaksa (faktiskās izmaksas)"
        action={
          <PageHelp
            title="Rentabilitāte — mēneša finanšu pārskats"
            sections={[
              {
                heading: 'Ko rāda šī lapa?',
                body: 'Katram projektam redza t: cik tas izmaksāja (DPR pašizmaksa) un cik jūs saņemat (līguma vērtība). Starpbība ir peļņa — manuālo Excel tabulu aizvieto šī skatījums.',
              },
              {
                heading: 'DPR pašizmaksa',
                body: 'DPR pašizmaksa ir faktiskā nauda, ko meistari reģistrēja ikdienas atskaitēs (darbs + tehnika + materiāli + transports). Tā ir precīzāka par jebkuru aplēsi, jo nāk no reāliem datiem.',
              },
              {
                heading: 'Marža',
                body: 'Marža = (Līguma vērtība − DPR pašizmaksa) ÷ Līguma vērtība × 100%. Normāla zemdarbu apakšuzņēmēja marža: 15–30%. Zemāk par 5% — projekts strādā gandrīz bez peļņas. Augstāk par 35% — vai līgums bija novērtēts pilnbīgi?',
              },
              {
                heading: 'Izmaksu koda sadalījums',
                body: 'Ikviena projekta sadaļā redza t izmaksu sadalījumu pa kategorijām. Tas rāda, kur nauda aiziet. Ja Tehnikas izmaksas ir neproporcionāli augstas — iekārtas, iespējams, tiek izmantotas neefektīvi.',
                tip: 'Pēc 3–6 mēnešiem var salīdz ināt līdzīg us projektus un noteikt sava uzņēmuma vidējo izmaksu profilu.',
              },
              {
                heading: 'Datumu filtrs',
                body: 'Pēc noklusējuma tiek rādīts aktūālais mēnesis. Iestatiet „No“ un „Līdz“ datumu, lai redzetu vēsturiskos datus vai salīdzinātu perioduss.',
              },
            ]}
          />
        }
      />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Projekts</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-44"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">Visi projekti</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">No</label>
          <Input
            type="date"
            className="h-9 w-36"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Līdz</label>
          <Input
            type="date"
            className="h-9 w-36"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-9 gap-1.5" onClick={load}>
          <Filter className="h-3.5 w-3.5" />
          Filtrēt
        </Button>
        <Button variant="outline" className="h-9 gap-1.5" onClick={exportCsv} disabled={!data}>
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ielādē…</div>
      ) : (
        <>
          {/* KPI summary row */}
          {totals && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Līguma vērtība
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtEur(totals.contractValue)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Ienākumi (pasūtītājs maksā)</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Pašizmaksa (DPR)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmtEur(totals.dprCost)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Faktiskās izmaksas no atskaitēm
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Bruto peļņa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${totals.grossMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {totals.grossMargin >= 0 ? '+' : ''}
                    {fmtEur(totals.grossMargin)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {totals.grossMargin < 0 ? 'Zaudējumi' : 'Peļņa'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Peļņas marža
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="text-2xl font-bold">
                    <MarginBadge pct={totals.marginPct} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Bruto peļņa / ienākumi</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Cost breakdown donut-style bar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Izmaksu struktūra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(COST_CODE_LABELS) as CostCode[])
                  .filter((c) => (costBreakdown[c] ?? 0) > 0)
                  .sort((a, b) => (costBreakdown[b] ?? 0) - (costBreakdown[a] ?? 0))
                  .map((code) => {
                    const val = costBreakdown[code] ?? 0;
                    const pct = totalCost > 0 ? (val / totalCost) * 100 : 0;
                    // Budget for this cost code (sum across all projects in filter)
                    const budgetForCode =
                      data?.projects.reduce((s, p) => s + (p.budgetByCode[code] ?? 0), 0) ?? 0;
                    const budgetPct =
                      budgetForCode > 0 ? Math.min((val / budgetForCode) * 100, 100) : 0;
                    const overBudget = budgetForCode > 0 && val > budgetForCode;
                    return (
                      <div key={code}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${COST_CODE_COLORS[code]}`}
                            />
                            {COST_CODE_LABELS[code]}
                          </div>
                          <div className="text-right">
                            <span className="font-semibold">{fmtEur(val)}</span>
                            {budgetForCode > 0 && (
                              <span
                                className={`ml-1 text-xs ${overBudget ? 'text-red-500 font-medium' : 'text-gray-400'}`}
                              >
                                / {fmtEur(budgetForCode)}
                              </span>
                            )}
                            <span className="text-gray-400 ml-1 text-xs">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        {budgetForCode > 0 ? (
                          <div className="h-2 w-full rounded-full bg-gray-100 relative overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${overBudget ? 'bg-red-400' : COST_CODE_COLORS[code]}`}
                              style={{ width: `${budgetPct}%` }}
                            />
                          </div>
                        ) : (
                          <div className="h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              className={`h-1.5 rounded-full ${COST_CODE_COLORS[code]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                {totalCost === 0 && (
                  <p className="text-sm text-gray-400">Nav DPR datu izvēlētajā periodā</p>
                )}
              </CardContent>
            </Card>

            {/* Monthly cost chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Izmaksas pa mēnešiem</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyCosts.length === 0 ? (
                  <p className="text-sm text-gray-400">Nav datu</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyCosts.map(({ month, cost }) => {
                      const [year, mo] = month.split('-');
                      const label = `${MONTH_LABELS[mo] ?? mo} ${year}`;
                      const barPct = (cost / maxMonthCost) * 100;
                      return (
                        <div key={month} className="flex items-center gap-3">
                          <span className="w-20 text-xs text-gray-500 text-right shrink-0">
                            {label}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
                            <div
                              className="h-5 bg-indigo-500 rounded-sm flex items-center px-2"
                              style={{ width: `${barPct}%`, minWidth: cost > 0 ? '2rem' : '0' }}
                            >
                              {barPct > 25 && (
                                <span className="text-white text-xs font-medium truncate">
                                  {fmtEur(cost)}
                                </span>
                              )}
                            </div>
                          </div>
                          {barPct <= 25 && (
                            <span className="text-xs text-gray-600 w-16 shrink-0">
                              {fmtEur(cost)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-project table */}
          {data && data.projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rentabilitāte pa projektiem</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projekts</TableHead>
                      <TableHead>Klients</TableHead>
                      <TableHead className="text-right">Līguma vērtība</TableHead>
                      <TableHead className="text-right">DPR izmaksas</TableHead>
                      <TableHead className="text-right">Bruto peļņa</TableHead>
                      <TableHead className="text-right">Marža</TableHead>
                      <TableHead>Statuss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.map((p: ProjectProfitabilitySummary) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-gray-500">{p.clientName ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtEur(p.contractValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtEur(p.dprCost)}
                          {p.budgetUsedPct !== null && (
                            <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                              <div
                                className={`h-1.5 rounded-full ${p.budgetUsedPct > 100 ? 'bg-red-400' : p.budgetUsedPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(p.budgetUsedPct, 100)}%` }}
                              />
                            </div>
                          )}
                          {p.budgetUsedPct !== null && (
                            <div
                              className={`text-xs mt-0.5 ${p.budgetUsedPct > 100 ? 'text-red-500' : 'text-gray-400'}`}
                            >
                              {p.budgetUsedPct.toFixed(0)}% no budžeta
                            </div>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-semibold ${p.grossMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {p.grossMargin >= 0 ? '+' : ''}
                          {fmtEur(p.grossMargin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <MarginBadge pct={p.marginPct} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              p.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : p.status === 'ACTIVE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                            }
                          >
                            {p.status === 'PLANNING'
                              ? 'Plānošana'
                              : p.status === 'ACTIVE'
                                ? 'Aktīvs'
                                : p.status === 'COMPLETED'
                                  ? 'Pabeigts'
                                  : p.status === 'ON_HOLD'
                                    ? 'Apturēts'
                                    : p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    {totals && (
                      <TableRow className="bg-gray-50 font-semibold">
                        <TableCell colSpan={2}>Kopā</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtEur(totals.contractValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtEur(totals.dprCost)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${totals.grossMargin >= 0 ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {totals.grossMargin >= 0 ? '+' : ''}
                          {fmtEur(totals.grossMargin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <MarginBadge pct={totals.marginPct} />
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data && data.projects.length === 0 && (
            <div className="rounded-lg border bg-white py-16 text-center text-sm text-gray-400">
              Nav projektu ar DPR datiem izvēlētajā periodā
            </div>
          )}
        </>
      )}
    </div>
  );
}
