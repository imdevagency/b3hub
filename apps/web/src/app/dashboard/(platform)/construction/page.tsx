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
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sveiki, {user.firstName}!</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {user.company?.name ?? 'Jūsu uzņēmums'} — celtniecības portāls
        </p>
      </div>

      {/* Quick stats */}
      {!loadingProjects && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <QuickStat label="Projekti" value={n(projects.length)} />
          <QuickStat label="Aktīvie" value={n(active.length)} />
          <QuickStat
            label="Budžeta izlietojums"
            value={totalContract > 0 ? `${Math.round((totalSpend / totalContract) * 100)}%` : '—'}
          />
        </div>
      )}

      {/* Recent projects */}
      {!loadingProjects && recentProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Pēdējie projekti
            </h2>
            <Link
              href="/dashboard/projects"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Skatīt visus <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
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

      {/* Trend indicator */}
      {!loadingProjects && projects.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FolderKanban className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nav projektu</p>
          <p className="text-xs mt-1">Sāciet, izveidojot savu pirmo projektu</p>
          <Link
            href="/dashboard/projects"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Jauns projekts <ArrowRight className="size-4" />
          </Link>
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
