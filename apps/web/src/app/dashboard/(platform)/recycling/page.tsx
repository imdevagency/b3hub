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
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sveiki, {user.firstName}!</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {user.company?.name ?? 'Jūsu uzņēmums'} — pārstrādes portāls
        </p>
      </div>

      {/* Quick stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <QuickStat label="Aktīvie darbi" value={n(activeJobs.length)} />
          <QuickStat label="Pabeigti šomēnes" value={n(completedThisMonth.length)} />
          <QuickStat label="Atkritumu rekordi" value={n(records.length)} />
        </div>
      )}

      {/* Recent jobs */}
      {!loading && recentJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pēdējie darbi
            </h2>
            <Link
              href="/dashboard/recycling/jobs"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Skatīt visus <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50"
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

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Ātrās darbības
        </h2>
        <div className="space-y-1">
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
