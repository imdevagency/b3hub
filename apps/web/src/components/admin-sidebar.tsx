/**
 * AdminSidebar — dedicated sidebar for ADMIN users.
 *
 * Shown instead of AppSidebar when user.userType === 'ADMIN'.
 * Single scope: Bilt marketplace admin — manages all four market sides
 * (buyers, suppliers, carriers, recyclers).
 * Live badge counts refreshed every 30 s.
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Box,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Flag,
  FolderKanban,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  Percent,
  Recycle,
  Scale,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Timer,
  Truck,
  Users,
  Wallet,
  Wrench,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_GROUPS } from '@/lib/admin-nav-groups';
import { useAuth } from '@/lib/auth-context';
import { makeIsRouteActive } from '@/lib/is-route-active';
import { getAdminStats, getUnreadNotificationCount } from '@/lib/api';
import { adminListSupportThreads } from '@/lib/api/support';
import { adminGetExceptions } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: keyof AdminBadges;
  /** Sum multiple badge keys onto a single group sidebar item */
  badgeKeys?: Array<keyof AdminBadges>;
  /** All paths in this group — makes the sidebar item active on any of them */
  groupPaths?: string[];
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

type AdminBadges = {
  notifications: number;
  pendingApplications: number;
  openDisputes: number;
  openSupport: number;
  openExceptions: number;
  activeJobs: number;
  triageAlerts: number;
};

// ─── Scope ───────────────────────────────────────────────────────────────────

type Scope = 'bilt';

// ─── Bilt navigation (marketplace admin) ────────────────────────────────────
// 7 items max — one per business domain. Tabs within each domain live
// in AdminSectionTabs (rendered by the admin layout), not here.

const B3HUB_NAV: NavSection[] = [
  {
    id: 'main',
    label: '',
    items: [
      {
        label: 'Vadības panelis',
        href: '/dashboard/admin',
        icon: LayoutDashboard,
      },
      {
        label: 'Operācijas',
        href: '/dashboard/admin/triage',
        icon: AlertTriangle,
        badgeKeys: ['triageAlerts', 'openExceptions', 'openSupport', 'openDisputes'],
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'operations')?.tabs.map((t) => t.href),
      },
      {
        label: 'Pasūtījumi',
        href: '/dashboard/admin/orders',
        icon: ShoppingBag,
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'orders')?.tabs.map((t) => t.href),
      },
      {
        label: 'Finanses',
        href: '/dashboard/admin/finances',
        icon: Wallet,
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'finance')?.tabs.map((t) => t.href),
      },
      {
        label: 'Dalībnieki',
        href: '/dashboard/admin/users',
        icon: Users,
        badgeKey: 'pendingApplications',
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'people')?.tabs.map((t) => t.href),
      },
      {
        label: 'Katalogs',
        href: '/dashboard/admin/catalog',
        icon: Package,
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'catalog')?.tabs.map((t) => t.href),
      },
      {
        label: 'Konfigurācija',
        href: '/dashboard/admin/config',
        icon: Settings2,
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'config')?.tabs.map((t) => t.href),
      },
      {
        label: 'Atskaites',
        href: '/dashboard/admin/analytics',
        icon: BarChart3,
        groupPaths: ADMIN_NAV_GROUPS.find((g) => g.id === 'reports')?.tabs.map((t) => t.href),
      },
    ],
  },
  {
    id: 'growth',
    label: 'Izaugsme',
    items: [
      { label: 'CMS', href: '/dashboard/admin/cms', icon: FileText },
      { label: 'Mārketings', href: '/dashboard/admin/marketing', icon: Megaphone },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrācijas',
    items: [
      {
        label: 'Visas integrācijas',
        href: '/dashboard/admin/integrations',
        icon: Link2,
        groupPaths: [
          '/dashboard/admin/integrations',
          '/dashboard/admin/integrations/lursoft',
          '/dashboard/admin/integrations/paysera',
          '/dashboard/admin/integrations/sms',
          '/dashboard/admin/integrations/email',
          '/dashboard/admin/integrations/maps',
        ],
      },
    ],
  },
];

// ─── Scope icon map ───────────────────────────────────────────────────────────

const SCOPE_ICON: Record<Scope, React.ElementType> = {
  bilt: ShieldCheck,
};

const SCOPE_SUBTITLE: Record<Scope, string> = {
  bilt: 'Platformas administrācija',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const activeScope: Scope = 'bilt';
  const activeNav = B3HUB_NAV;

  const ScopeIcon = SCOPE_ICON[activeScope];

  const [badges, setBadges] = React.useState<AdminBadges>({
    notifications: 0,
    pendingApplications: 0,
    openDisputes: 0,
    openSupport: 0,
    openExceptions: 0,
    activeJobs: 0,
    triageAlerts: 0,
  });

  const isActive = React.useMemo(
    () => makeIsRouteActive(pathname, ['/dashboard/admin']),
    [pathname],
  );

  // Live badge refresh — only runs for Bilt scope (where badges are meaningful)
  React.useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const [statsRes, notifRes, supportRes, exceptionsRes] = await Promise.allSettled([
        getAdminStats(token),
        getUnreadNotificationCount(token),
        adminListSupportThreads(token),
        adminGetExceptions(token, 'OPEN'),
      ]);

      if (cancelled) return;

      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
      const notif = notifRes.status === 'fulfilled' ? notifRes.value : null;
      const support = supportRes.status === 'fulfilled' ? supportRes.value : [];
      const exceptions = exceptionsRes.status === 'fulfilled' ? exceptionsRes.value : [];

      const d = Math.max(0, stats?.openDisputes ?? 0);
      const s = Math.max(0, support.filter((t) => t.status === 'OPEN').length);
      const x = Math.max(0, exceptions.length);
      setBadges({
        notifications: Math.max(0, notif?.count ?? 0),
        pendingApplications: Math.max(0, stats?.pendingApplications ?? 0),
        openDisputes: d,
        openSupport: s,
        openExceptions: x,
        activeJobs: Math.max(0, stats?.activeJobs ?? 0),
        triageAlerts: d + s + x,
      });
    };

    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  const renderBadge = React.useCallback((count: number) => {
    if (count <= 0) return null;
    const display = count > 99 ? '99+' : String(count);
    return (
      <Badge
        variant="destructive"
        className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px] leading-none group-data-[collapsible=icon]:hidden"
      >
        {display}
      </Badge>
    );
  }, []);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'A';

  const totalAlerts =
    badges.pendingApplications + badges.openDisputes + badges.openSupport + badges.openExceptions;

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-200" {...props}>
      {/* Brand + scope icon */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Admin">
              <Link href="/dashboard/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-900 text-white shrink-0 relative">
                  <ScopeIcon className="size-4" />
                  {totalAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold group-data-[collapsible=icon]:flex">
                      {totalAlerts > 9 ? '!' : totalAlerts}
                    </span>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Bilt</span>
                  <span className="truncate text-xs text-gray-500">
                    {SCOPE_SUBTITLE[activeScope]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav sections — scoped per business unit */}
      <SidebarContent>
        {activeNav.map((section) => (
          <SidebarGroup key={section.id} className="pt-2">
            {section.label && (
              <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider pb-1">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {section.items.map((item) => {
                const active = isActive(item);
                const count = item.badgeKeys
                  ? item.badgeKeys.reduce((sum, k) => sum + badges[k], 0)
                  : item.badgeKey
                    ? badges[item.badgeKey]
                    : 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={active}
                      className="font-medium text-gray-600 hover:text-gray-900"
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                        {renderBadge(count)}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer: user + logout */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={user?.email ?? 'Admin'}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="rounded-lg bg-gray-800 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin'}
                </span>
                <span className="truncate text-xs text-gray-500">{user?.email}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Iziet"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              <LogOut className="size-4 shrink-0" />
              <span>Iziet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
