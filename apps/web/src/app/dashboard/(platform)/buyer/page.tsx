/**
 * Buyer overview page — /dashboard/buyer
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  ArrowRight,
  ClipboardList,
  Package,
  Receipt,
  Truck,
  Recycle,
  ScrollText,
  ChevronRight,
  Zap,
  Settings,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ActionListItem } from '@/components/ui/action-list-item';
import { PageSpinner } from '@/components/ui/page-spinner';

const n = (v?: number) => (v !== undefined ? String(v) : '0');
const num = (v?: number) => v ?? 0;

// ── Service tiles (2-col grid — primary ordering actions) ─────────────────────
type ServiceTile = { label: string; sub: string; icon: LucideIcon; href: string; accent?: boolean };

const SERVICE_TILES: ServiceTile[] = [
  {
    label: 'Materiāli',
    sub: 'Grants, smiltis, betona izstrādājumi',
    icon: Package,
    href: '/dashboard/catalog',
    accent: true,
  },
  {
    label: 'Kravas transports',
    sub: 'No A uz B jebkura krava',
    icon: Truck,
    href: '/dashboard/order/transport',
  },
  {
    label: 'Utilizācija',
    sub: 'Atkritumi bez konteinera',
    icon: Recycle,
    href: '/dashboard/order/disposal',
  },
];

// ── Manage list items ─────────────────────────────────────────────────────────
type ManageItem = { label: string; description: string; icon: LucideIcon; href: string };

const MANAGE_ITEMS: ManageItem[] = [
  {
    label: 'Mani Pasūtījumi',
    description: 'Skatīt aktīvos un vēsturiskos pasūtījumus',
    icon: ClipboardList,
    href: '/dashboard/orders',
  },
  {
    label: 'Rēķini & Dokumenti',
    description: 'Rēķini, piegādes dokumenti un sertifikāti',
    icon: Receipt,
    href: '/dashboard/documents',
  },
  {
    label: 'Iestatījumi',
    description: 'Profils, paziņojumi un drošība',
    icon: Settings,
    href: '/dashboard/settings',
  },
  {
    label: 'Palīdzība',
    description: 'BIJ jautājumi un atbalsts',
    icon: HelpCircle,
    href: '/dashboard/help',
  },
];

export default function BuyerDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    setActiveMode('BUYER');
  }, [setActiveMode]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    getDashboardStats(token)
      .then(setData)
      .catch(() => {});
  }, [user, token]);

  if (isLoading || !user) {
    return <PageSpinner className="min-h-[60vh]" />;
  }

  const activeOrders = num(data?.activeOrders);
  const awaitingDelivery = num(data?.awaitingDelivery);
  const totalOrders = num(data?.myOrders);
  const isNewUser = data !== null && totalOrders === 0 && activeOrders === 0;
  const hasActivity = activeOrders > 0 || awaitingDelivery > 0;

  // Manage items — inject framework contracts for company accounts
  const manageItems: ManageItem[] = user.isCompany
    ? [
        MANAGE_ITEMS[0],
        MANAGE_ITEMS[1],
        {
          label: 'Pamatlīgumi',
          description: 'Apjoma līgumi un piegādes grafiki',
          icon: ScrollText,
          href: '/dashboard/framework-contracts',
        },
        MANAGE_ITEMS[2],
        MANAGE_ITEMS[3],
      ]
    : MANAGE_ITEMS;

  return (
    <div className="w-full pb-16 space-y-8">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sveiki, {user.firstName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {hasActivity
              ? 'Jums ir aktīvi pasūtījumi.'
              : 'Materiāli, konteineri vai pakalpojumi — viss vienā vietā.'}
          </p>
        </div>
        {user.company?.name && (
          <span className="text-xs font-semibold bg-muted px-3 py-1.5 rounded-full text-muted-foreground shrink-0 ml-4">
            {user.company.name}
          </span>
        )}
      </div>

      {/* ── STATS STRIP — clickable ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 border border-gray-200 rounded-xl bg-white divide-x divide-gray-200 overflow-hidden">
        <Link
          href="/dashboard/orders"
          className="px-5 py-4 hover:bg-gray-50 transition-colors group"
        >
          <span
            className={`text-3xl font-semibold tracking-tight block ${activeOrders > 0 ? 'text-green-600' : 'text-foreground'}`}
          >
            {n(data?.activeOrders)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider flex items-center gap-1">
            Procesā
            <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </Link>
        <Link
          href="/dashboard/deliveries"
          className="px-5 py-4 hover:bg-gray-50 transition-colors group"
        >
          <span
            className={`text-3xl font-semibold tracking-tight block ${awaitingDelivery > 0 ? 'text-blue-600' : 'text-foreground'}`}
          >
            {n(data?.awaitingDelivery)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider flex items-center gap-1">
            Gaidāmās Piegādes
            <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </Link>
        <Link
          href="/dashboard/orders"
          className="px-5 py-4 hover:bg-gray-50 transition-colors group"
        >
          <span className="text-3xl font-semibold tracking-tight block text-foreground">
            {n(data?.myOrders)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider flex items-center gap-1">
            Kopā
            <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </Link>
      </div>

      {/* ── ADAPTIVE HERO BANNER ────────────────────────────────────────── */}
      {isNewUser ? (
        /* Onboarding card for first-time users */
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 flex flex-col items-center text-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Sāciet pirmo pasūtījumu</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Izvēlieties materiālu vai pakalpojumu zemāk un saņemiet piedāvājumu minūtēs.
            </p>
          </div>
          <Link
            href="/dashboard/catalog"
            className="inline-flex items-center gap-2 mt-1 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            Aplūkot katalogu
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : hasActivity ? (
        /* Active orders state */
        <Link
          href="/dashboard/orders"
          className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 transition-transform active:scale-[0.98] hover:shadow-lg"
        >
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                {activeOrders > 0
                  ? `${activeOrders} aktīvi pasūtījumi`
                  : `${awaitingDelivery} piegādes gaidā`}
              </div>
              <h2 className="text-xl font-semibold">Izsekot pasūtījumus</h2>
              <p className="text-background/70 text-sm mt-1">
                Skatīt statusu, piegādes laiku un dokumentus
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
              <ArrowRight className="h-6 w-6 text-background" />
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
        </Link>
      ) : (
        /* Default — catalog CTA */
        <Link
          href="/dashboard/catalog"
          className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 transition-transform active:scale-[0.98] hover:shadow-lg"
        >
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
                <Package className="h-3 w-3" />
                Katalogs
              </div>
              <h2 className="text-xl font-semibold">Pasūtīt Materiālus</h2>
              <p className="text-background/70 text-sm mt-1">
                Grants, smiltis, betona izstrādājumi un citi
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
              <ArrowRight className="h-6 w-6 text-background" />
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
        </Link>
      )}

      {/* ── SERVICE TILES — 2×2 grid ────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Pakalpojumi
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className={`group flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-sm active:scale-[0.98] ${
                  tile.accent
                    ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    tile.accent
                      ? 'bg-primary/15 text-primary'
                      : 'bg-gray-100 text-gray-500 group-hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {tile.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tile.sub}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── MANAGE LIST ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Pārvaldība
        </h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
          {manageItems.map((item) => (
            <ActionListItem
              key={item.href}
              label={item.label}
              description={item.description}
              icon={item.icon}
              href={item.href}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
