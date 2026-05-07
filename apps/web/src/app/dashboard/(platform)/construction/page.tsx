/**
 * Construction company portal home — /dashboard/construction
 * Entry point for companies with companyType: CONSTRUCTION.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getProjects, type ApiProject } from '@/lib/api';
import {
  FolderKanban,
  Package,
  Receipt,
  ClipboardList,
  BarChart3,
  ArrowRight,
  TrendingUp,
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
    label: 'Mani projekti',
    description: 'Skatīt un pārvaldīt būvniecības projektus',
    icon: FolderKanban,
    href: '/dashboard/projects',
    primary: true,
  },
  {
    label: 'Pasūtīt materiālus',
    description: 'Materiālu katalogs un jauni pasūtījumi',
    icon: Package,
    href: '/dashboard/catalog',
  },
  {
    label: 'Pasūtījumi',
    description: 'Skatīt visus materiālu pasūtījumus',
    icon: ClipboardList,
    href: '/dashboard/orders',
  },
  {
    label: 'Rēķini',
    description: 'Rēķini un maksājumu vēsture',
    icon: Receipt,
    href: '/dashboard/invoices',
  },
  {
    label: 'Analītika',
    description: 'Izmaksu pārskati un tendences',
    icon: BarChart3,
    href: '/dashboard/analytics',
  },
];

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PLANNING: 'Plānošana',
    ACTIVE: 'Aktīvs',
    COMPLETED: 'Pabeigts',
    ON_HOLD: 'Apturēts',
  };
  return map[status] ?? status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    PLANNING: 'text-amber-600',
    ACTIVE: 'text-emerald-600',
    COMPLETED: 'text-muted-foreground',
    ON_HOLD: 'text-red-500',
  };
  return map[status] ?? 'text-muted-foreground';
}

const n = (v?: number) => (v !== undefined ? String(v) : '0');

export default function ConstructionHomePage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Sync sidebar mode to CONSTRUCTION
  useEffect(() => {
    setActiveMode('CONSTRUCTION');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    getProjects(token)
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, [user, token]);

  if (isLoading || !user) return <PageSpinner />;

  const active = projects.filter((p) => p.status === 'ACTIVE');
  const totalContract = projects.reduce((s, p) => s + (p.contractValue ?? 0), 0);
  const totalSpend = projects.reduce((s, p) => s + (p.materialCosts ?? 0), 0);
  const recentProjects = [...projects]
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
            {user.company?.name ?? 'Jūsu uzņēmums'} — celtniecības portāls
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="grid grid-cols-3 border border-gray-200 rounded-xl bg-white divide-x divide-gray-200 overflow-hidden">
          <div className="px-5 py-4">
            <QuickStat variant="minimal" label="Projekti" value={n(projects.length)} />
          </div>
          <div className="px-5 py-4">
            <QuickStat variant="minimal" label="Aktīvie" value={n(active.length)} />
          </div>
          <div className="px-5 py-4">
            <QuickStat
              variant="minimal"
              label="Budžeta izlietojums"
              value={totalContract > 0 ? `${Math.round((totalSpend / totalContract) * 100)}%` : '—'}
            />
          </div>
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link
        href="/dashboard/construction/projects"
        className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {active.length > 0 ? `${active.length} aktīvi projekti` : 'Pārvaldi projektus'}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">Mani Projekti</h2>
            <p className="text-background/70 text-sm mt-1">
              Skatīt budžetus, dienas atskaites un piegāžu vietas
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
            <ArrowRight className="h-6 w-6 text-background" />
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
      </Link>

      {/* Recent projects */}
      {!loadingProjects && recentProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pēdējie projekti
            </h2>
            <Link
              href="/dashboard/construction/projects"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Skatīt visus <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/construction/projects/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.siteAddress && (
                    <p className="text-xs text-muted-foreground truncate">{p.siteAddress}</p>
                  )}
                </div>
                <span className={`text-xs font-medium shrink-0 ml-3 ${statusColor(p.status)}`}>
                  <span className="flex items-center gap-1">
                    <CircleDot className="size-3" />
                    {statusLabel(p.status)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingProjects && projects.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FolderKanban className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nav projektu</p>
          <p className="text-xs mt-1">Sāciet, izveidojot savu pirmo projektu</p>
          <Link
            href="/dashboard/construction/projects"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Jauns projekts <ArrowRight className="size-4" />
          </Link>
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
