/**
 * B3 Construction — Admin Dashboard
 * /dashboard/b3-construction
 *
 * Live KPI overview: active projects, monthly DPR cost, top project, recent DPRs.
 */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  ClipboardList,
  Euro,
  FolderKanban,
  Loader2,
  Truck,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { PageHelp } from '@/components/ui/page-help';
import {
  adminGetConstructionProjects,
  adminGetDailyReports,
  adminGetConstructionProfitability,
  adminGetEmployees,
  type AdminConstructionProject,
  type DailyReport,
  type ConstructionProfitabilityResponse,
} from '@/lib/api/admin';
import { CONSTRUCTION_PROJECT_STATUS, DPR_STATUS, StatusBadgeTw } from '@/lib/status-config';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function B3ConstructionPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<AdminConstructionProject[]>([]);
  const [recentDprs, setRecentDprs] = useState<DailyReport[]>([]);
  const [profitability, setProfitability] = useState<ConstructionProfitabilityResponse | null>(
    null,
  );
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!token) return;

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const from = thisMonthStart.toISOString().slice(0, 10);

    Promise.allSettled([
      adminGetConstructionProjects(token, { limit: 50 }),
      adminGetDailyReports(token, { limit: 5 }),
      adminGetConstructionProfitability(token, { from }),
      adminGetEmployees(token, { limit: 1 }),
    ])
      .then(([projRes, dprRes, profRes, empRes]) => {
        if (projRes.status === 'fulfilled') setProjects(projRes.value.data);
        if (dprRes.status === 'fulfilled') setRecentDprs(dprRes.value.data);
        if (profRes.status === 'fulfilled') setProfitability(profRes.value);
        if (empRes.status === 'fulfilled') {
          const r = empRes.value as { total?: number; data: unknown[] };
          setEmployeeCount(r.total ?? r.data.length);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [token]);

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const planningProjects = projects.filter((p) => p.status === 'PLANNING');
  const completedThisYear = projects.filter(
    (p) =>
      p.status === 'COMPLETED' &&
      p.endDate &&
      new Date(p.endDate).getFullYear() === new Date().getFullYear(),
  );

  const totalContractValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const monthlyDprCost = profitability?.totals.dprCost ?? 0;
  const monthlyMarginPct = profitability?.totals.marginPct ?? 0;

  const topProject =
    profitability?.projects.slice().sort((a, b) => b.dprCost - a.dprCost)[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B3 Construction"
        description="Zemdarbu apakšuzņēmēja projektu pārvaldība"
        action={
          <PageHelp
            title="Kā darbojas B3 Construction vadības sistēma"
            sections={[
              {
                heading: 'Sistēmas princips',
                body: 'B3 Construction ir zemdarbu apakšuzņēmējs — uzņēmums veic zemes darbus (izrakšanu, pildīšanu, pamatus) galvenajiem uzņēmējiem vai investoriem. Šī sistēma seko katra darbu objekta izmaksām un peļņai.',
              },
              {
                heading: 'Ikdienas darba plūsma',
                steps: [
                  'Meistars katru dienu aizpilda DPR (Dienas ražošanas atskaiti) — kurš strādāja, kāda tehnika, cik materiālu.',
                  'Sistēma automātiski reizina daudzumu × likmi un aprēķina dienas izmaksas.',
                  'Jūs apstiprinat atskaiti — un tā ietekmē projekta rentabilitāti.',
                ],
              },
              {
                heading: 'Galvenie rādītāji',
                body: 'DPR izmaksas = faktiskās izmaksas no dienas atskaitēm. Marža = (Līguma vērtība − DPR izmaksas) ÷ Līguma vērtība. Veselīga zemdarbu projekta marža ir 15–30%.',
              },
              {
                heading: 'Kā sākt (pirmās reizes)',
                steps: [
                  'Iestatījumi → Klienti: pievienojiet pasūtītāja uzņēmumu.',
                  'Iestatījumi → Darbinieki: ievadiet lauka darbiniekus ar viņu stundu tarifiem.',
                  'Iestatījumi → Izmaksu likmes: iestatiet likmes arī tehnikai, transportam, materiāliem.',
                  'Iestatījumi → DPR Veidnes: izveidojiet vienu standarta dienas veidni.',
                  'Projekti → Jauns projekts: ievadiet pirmo objektu.',
                ],
              },
            ]}
          />
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Ielādē...
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Neizdevās ielādēt datus. Pārlādējiet lapu.
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              icon={FolderKanban}
              iconClass="text-orange-600"
              bgClass="bg-orange-50"
              label="Aktīvie projekti"
              value={String(activeProjects.length)}
              sub={
                planningProjects.length > 0 ? `+${planningProjects.length} plānošanā` : undefined
              }
              href="/dashboard/b3-construction/projects"
            />
            <KpiCard
              icon={Euro}
              iconClass="text-blue-600"
              bgClass="bg-blue-50"
              label="DPR izmaksas (mēnesis)"
              value={fmtEur(monthlyDprCost)}
              sub={
                monthlyMarginPct !== 0
                  ? `${monthlyMarginPct >= 0 ? '+' : ''}${monthlyMarginPct.toFixed(1)}% marža`
                  : undefined
              }
              subClass={monthlyMarginPct >= 0 ? 'text-green-600' : 'text-red-500'}
              href="/dashboard/b3-construction/profitability"
            />
            <KpiCard
              icon={Building2}
              iconClass="text-purple-600"
              bgClass="bg-purple-50"
              label="Kopējā līgumu vērtība"
              value={fmtEur(totalContractValue)}
              sub={
                completedThisYear.length > 0
                  ? `${completedThisYear.length} pabeigti šogad`
                  : undefined
              }
              href="/dashboard/b3-construction/projects"
            />
            <KpiCard
              icon={Users}
              iconClass="text-violet-600"
              bgClass="bg-violet-50"
              label="Darbinieki"
              value={String(employeeCount)}
              href="/dashboard/b3-construction/employees"
            />
          </div>

          {/* Active projects + recent DPRs */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Active projects list */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">Aktīvie projekti</CardTitle>
                <Link
                  href="/dashboard/b3-construction/projects"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                >
                  Visi <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {activeProjects.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-400">
                    Nav aktīvu projektu
                  </div>
                ) : (
                  <ul className="divide-y">
                    {activeProjects.slice(0, 6).map((p) => (
                      <li
                        key={p.id}
                        className="flex cursor-pointer items-center justify-between px-6 py-3 hover:bg-gray-50"
                        onClick={() => router.push(`/dashboard/b3-construction/projects/${p.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-gray-400">{p.clientName ?? '—'}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums">
                            {fmtEur(p.contractValue)}
                          </span>
                          {p.budgetUsedPct !== null && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-16 rounded-full bg-gray-100">
                                <div
                                  className={`h-1.5 rounded-full ${p.budgetUsedPct > 100 ? 'bg-red-400' : p.budgetUsedPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                  style={{ width: `${Math.min(p.budgetUsedPct, 100)}%` }}
                                />
                              </div>
                              <span
                                className={`text-xs tabular-nums ${p.budgetUsedPct > 100 ? 'text-red-500' : 'text-gray-400'}`}
                              >
                                {p.budgetUsedPct.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {activeProjects.length > 6 && (
                  <div className="border-t px-6 py-2 text-center">
                    <Link
                      href="/dashboard/b3-construction/projects"
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      Vēl {activeProjects.length - 6} projekti →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent DPRs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold">Pēdējās dienas atskaites</CardTitle>
                <Link
                  href="/dashboard/b3-construction/daily-reports"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                >
                  Visas <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {recentDprs.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-400">
                    Nav DPR ierakstu
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentDprs.map((dpr) => (
                      <li
                        key={dpr.id}
                        className="flex cursor-pointer items-center justify-between px-6 py-3 hover:bg-gray-50"
                        onClick={() => router.push('/dashboard/b3-construction/daily-reports')}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{dpr.project?.name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{fmtDate(dpr.reportDate)}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                          {dpr.totalCost !== undefined && (
                            <span className="text-sm font-semibold tabular-nums">
                              {fmtEur(dpr.totalCost)}
                            </span>
                          )}
                          <StatusBadgeTw cfg={DPR_STATUS[dpr.status]} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t px-6 py-3">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => router.push('/dashboard/b3-construction/daily-reports')}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Jauna dienas atskaite
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top project this month */}
          {topProject && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Aktīvākais projekts (mēnesis)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="cursor-pointer rounded-lg border p-4 hover:bg-gray-50"
                  onClick={() =>
                    router.push(`/dashboard/b3-construction/projects/${topProject.id}`)
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{topProject.name}</p>
                      <p className="text-sm text-gray-500">{topProject.clientName ?? '—'}</p>
                    </div>
                    <StatusBadgeTw cfg={CONSTRUCTION_PROJECT_STATUS[topProject.status]} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Stat label="DPR izmaksas" value={fmtEur(topProject.dprCost)} />
                    <Stat label="Līguma vērtība" value={fmtEur(topProject.contractValue)} />
                    <Stat
                      label="Marža"
                      value={`${topProject.marginPct >= 0 ? '+' : ''}${topProject.marginPct.toFixed(1)}%`}
                      valueClass={topProject.marginPct >= 0 ? 'text-green-700' : 'text-red-600'}
                    />
                  </div>
                  {topProject.budgetUsedPct !== null && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-gray-400">
                        <span>Budžeta izlietojums</span>
                        <span
                          className={
                            topProject.budgetUsedPct > 100 ? 'font-medium text-red-500' : ''
                          }
                        >
                          {topProject.budgetUsedPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${topProject.budgetUsedPct > 100 ? 'bg-red-400' : topProject.budgetUsedPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(topProject.budgetUsedPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  iconClass,
  bgClass,
  label,
  value,
  sub,
  subClass = 'text-gray-400',
  href,
}: {
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="pb-4 pt-5">
          <div className="mb-3 flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgClass}`}>
              <Icon className={`h-4 w-4 ${iconClass}`} />
            </div>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {sub && <p className={`mt-0.5 text-xs ${subClass}`}>{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
