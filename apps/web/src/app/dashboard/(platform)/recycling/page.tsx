/**
 * Recycler company portal home — /dashboard/recycling
 * Entry point for companies with companyType: RECYCLER (canRecycle: true).
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getRecyclerIncomingJobs, getRecyclerWasteRecords } from '@/lib/api';
import type { RecyclerIncomingJob, RecyclerWasteRecord } from '@/lib/api';
import {
  Recycle,
  Truck,
  ClipboardList,
  FolderOpen,
  BarChart3,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { PageSpinner } from '@/components/ui/page-spinner';
import { QuickStat } from '@/components/ui/quick-stat';
import { ActionListItem } from '@/components/ui/action-list-item';

type QuickAction = {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
};

const ACTIONS: QuickAction[] = [
  {
    label: 'Ienākošie darbi',
    description: 'Transporta uzdevumi ar atkritumus uz jūsu centriem',
    icon: Truck,
    href: '/dashboard/recycling/jobs',
    primary: true,
  },
  {
    label: 'Atkritumu žurnāls',
    description: 'Pieņemtie atkritumi un apstrādes rekordi',
    icon: ClipboardList,
    href: '/dashboard/recycling/waste-records',
  },
  {
    label: 'Dokumenti',
    description: 'Sertifikāti un atbilstības dokumenti',
    icon: FolderOpen,
    href: '/dashboard/documents',
  },
  {
    label: 'Analītika',
    description: 'Apstrādes statistika un pārskati',
    icon: BarChart3,
    href: '/dashboard/analytics',
  },
];

const JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Apstiprināts',
  EN_ROUTE_PICKUP: 'Brauc uz paņemšanu',
  EN_ROUTE_DROPOFF: 'Ceļā',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const JOB_STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-600',
  ASSIGNED: 'text-blue-600',
  ACCEPTED: 'text-blue-600',
  EN_ROUTE_PICKUP: 'text-emerald-600',
  EN_ROUTE_DROPOFF: 'text-emerald-600',
  COMPLETED: 'text-muted-foreground',
  CANCELLED: 'text-red-500',
};

const n = (v?: number) => (v !== undefined ? String(v) : '0');

export default function RecyclingHomePage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();

  const [jobs, setJobs] = useState<RecyclerIncomingJob[]>([]);
  const [records, setRecords] = useState<RecyclerWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync sidebar mode to RECYCLER
  useEffect(() => {
    setActiveMode('RECYCLER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    Promise.allSettled([getRecyclerIncomingJobs(token), getRecyclerWasteRecords(token)]).then(
      ([jobsRes, recordsRes]) => {
        if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value);
        if (recordsRes.status === 'fulfilled') setRecords(recordsRes.value);
        setLoading(false);
      },
    );
  }, [user, token]);

  if (isLoading || !user) return <PageSpinner />;

  const activeJobs = jobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const completedThisMonth = jobs.filter((j) => {
    if (j.status !== 'COMPLETED') return false;
    const d = new Date(j.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <div className="w-full h-full pb-20 space-y-10">
      {/* HEADER SECTION */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Sveiki, {user.firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {user.company?.name ?? 'Jūsu uzņēmums'} — pārstrādes portāls
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="grid grid-cols-3 border border-gray-200 rounded-xl bg-white divide-x divide-gray-200 overflow-hidden">
          <div className="px-5 py-4">
            <QuickStat variant="minimal" label="Aktīvie darbi" value={n(activeJobs.length)} />
          </div>
          <div className="px-5 py-4">
            <QuickStat
              variant="minimal"
              label="Pabeigti šomēnes"
              value={n(completedThisMonth.length)}
            />
          </div>
          <div className="px-5 py-4">
            <QuickStat variant="minimal" label="Atkritumu rekordi" value={n(records.length)} />
          </div>
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link
        href="/dashboard/recycling/jobs"
        className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {activeJobs.length > 0
                ? `${activeJobs.length} aktīvi darbi`
                : 'Izskati pieprasījumus'}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">Ienākošie Darbi</h2>
            <p className="text-background/70 text-sm mt-1">
              Apstrādā transporta uzdevumus ar atkritumus uz jūsu centriem
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
            <ArrowRight className="h-6 w-6 text-background" />
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
      </Link>

      {/* Recent jobs */}
      {!loading && recentJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pēdējie darbi
            </h2>
            <Link
              href="/dashboard/recycling/jobs"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Skatīt visus <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {job.recyclingCenter?.name ?? 'Centrs nezināms'}
                  </p>
                  {job.requester && (
                    <p className="text-xs text-muted-foreground truncate">
                      {job.requester.firstName} {job.requester.lastName}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium shrink-0 ml-3 ${JOB_STATUS_COLOR[job.status] ?? 'text-muted-foreground'}`}
                >
                  <span className="flex items-center gap-1">
                    <CircleDot className="size-3" />
                    {JOB_STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Recycle className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nav ienākošo darbu</p>
          <p className="text-xs mt-1">
            Šeit parādīsies atkritumu transporta uzdevumi uz jūsu centriem
          </p>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div className="pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Ātrās Darbības
        </h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
          {ACTIONS.map((action) => (
            <ActionListItem
              key={action.href}
              label={action.label}
              description={action.description}
              icon={action.icon}
              href={action.href}
              primary={action.primary}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
