/**
 * B3 Recycling — Admin overview
 * /dashboard/b3-recycling
 *
 * Live KPI dashboard for the Gulbene licensed recycling facility.
 * Loads inbound jobs + waste records and computes real-time metrics.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  Leaf,
  Loader2,
  MapPin,
  Recycle,
  Truck,
  Weight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  adminGetRecyclingJobs,
  adminGetRecyclingWasteRecords,
  adminGetApusStats,
  type RecyclingInboundJob,
  type RecyclingWasteRecord,
  type ApusStats,
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
  return `${n.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`;
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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

// ─── Quick-nav links ──────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'Ienākošie darbi',
    description: 'Tiešsaistē rezervētie atkritumu pieņemšanas darbi.',
    icon: Truck,
    href: '/dashboard/b3-recycling/jobs',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Atkritumu žurnāls',
    description: 'Pieņemto atkritumu apjomi pa veidiem: betons, augsne, metāli, koks.',
    icon: ClipboardList,
    href: '/dashboard/b3-recycling/waste-log',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'Finanses & Vide',
    description: 'Ieņēmumi, vides rādītāji, CO₂ novirzīšana.',
    icon: BarChart3,
    href: '/dashboard/b3-recycling/finances',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    title: 'Sertifikāti',
    description: 'Atkritumu nodošanas sertifikāti un APUS atskaites.',
    icon: FileText,
    href: '/dashboard/b3-recycling/certificates',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    title: 'APUS ziņojumi',
    description: 'VVD obligātā atkritumu plūsmu ziņošana.',
    icon: BarChart3,
    href: '/dashboard/b3-recycling/apus',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    title: 'Gulbenes lauks',
    description: 'Darba laiki un lauka iestatījumi.',
    icon: MapPin,
    href: '/dashboard/admin/b3-fields',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function B3RecyclingPage() {
  const { token } = useAuth();

  const [jobs, setJobs] = useState<RecyclingInboundJob[]>([]);
  const [records, setRecords] = useState<RecyclingWasteRecord[]>([]);
  const [apus, setApus] = useState<ApusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, recordsRes, apusRes] = await Promise.allSettled([
        adminGetRecyclingJobs(token, { limit: 500 }),
        adminGetRecyclingWasteRecords(token, { limit: 500 }),
        adminGetApusStats(token),
      ]);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data);
      if (recordsRes.status === 'fulfilled') setRecords(recordsRes.value.data);
      if (apusRes.status === 'fulfilled') setApus(apusRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── KPI computations ────────────────────────────────────────────────────────

  const todayJobs = jobs.filter((j) => j.createdAt && isToday(j.createdAt));
  const mtdJobs = jobs.filter((j) => j.createdAt && isThisMonth(j.createdAt));
  const pendingJobs = jobs.filter((j) => j.status === 'PENDING' || j.status === 'CONFIRMED');
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');

  const mtdRevenue = mtdJobs
    .filter((j) => j.status === 'COMPLETED' || j.paymentStatus === 'PAID')
    .reduce((s, j) => s + j.total, 0);

  const totalWeightKg = records.reduce((s, r) => s + r.weight, 0);
  const mtdWeightKg = records
    .filter((r) => r.processedDate && isThisMonth(r.processedDate))
    .reduce((s, r) => s + r.weight, 0);
  const totalRecyclableKg = records.reduce((s, r) => s + (r.recyclableWeight ?? 0), 0);
  const co2Diverted = (totalRecyclableKg / 1000) * 0.35;

  const recordsWithRate = records.filter((r) => r.recyclingRate != null);
  const avgRate =
    recordsWithRate.length > 0
      ? recordsWithRate.reduce((s, r) => s + (r.recyclingRate ?? 0), 0) / recordsWithRate.length
      : 0;

  const certCount = records.filter((r) => r.certificateUrl).length;
  const pendingCerts = records.filter((r) => !r.certificateUrl && r.weight > 0).length;

  const statusCounts: Record<string, number> = {};
  for (const j of jobs) {
    statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B3 Recycling"
        description="Gulbenes licencētā būvgružu pārstrādes objekta pārvaldība"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ielādē datus…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="Darbi šodien"
              value={todayJobs.length}
              sub={`${pendingJobs.length} gaida apstrādi`}
              icon={Truck}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <KpiCard
              label="Pieņemts MTD"
              value={tonnes(mtdWeightKg / 1000)}
              sub={`Kopā: ${tonnes(totalWeightKg / 1000)}`}
              icon={Weight}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <KpiCard
              label="Ieņēmumi MTD"
              value={eur(mtdRevenue)}
              sub={`${completedJobs.length} pabeigti darbi`}
              icon={BarChart3}
              color="text-green-600"
              bg="bg-green-50"
            />
            <KpiCard
              label="CO₂ novirzīts"
              value={`${co2Diverted.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`}
              sub={`Vid. atgūšana: ${avgRate.toFixed(0)}%`}
              icon={Leaf}
              color="text-teal-600"
              bg="bg-teal-50"
            />
          </div>

          {/* ── Second KPI row ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="Darbi šomēnes"
              value={mtdJobs.length}
              sub={`${statusCounts['PROCESSING'] ?? 0} apstrādē`}
              icon={Recycle}
              color="text-purple-600"
              bg="bg-purple-50"
            />
            <KpiCard
              label="Izsniegti sertif."
              value={certCount}
              sub={`${pendingCerts} gaida sertifikātu`}
              icon={FileText}
              color="text-green-600"
              bg="bg-green-50"
            />
            <KpiCard
              label="APUS iesniegts"
              value={apus?.submitted ?? 0}
              sub={`${apus?.pending ?? 0} gaida`}
              icon={CheckCircle2}
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
            <KpiCard
              label="Pārstrādāts"
              value={tonnes(totalRecyclableKg / 1000)}
              sub={`No ${tonnes(totalWeightKg / 1000)} kopā`}
              icon={Weight}
              color="text-orange-600"
              bg="bg-orange-50"
            />
          </div>

          {/* ── Job status breakdown ── */}
          {jobs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground">Darbu statusi:</span>
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} variant="secondary" className="text-xs">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Quick-nav section cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${section.bg}`}
                    >
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  <p className="text-sm text-gray-500">{section.description}</p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
