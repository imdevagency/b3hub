/**
 * AdminSidebar — dedicated sidebar for ADMIN users.
 *
 * Shown instead of AppSidebar when user.userType === 'ADMIN'.
 * Organised into logical ERP sections with live badge counts.
 * Refreshes badge counts every 30 s.
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  Package,
  Recycle,
  ScrollText,
  ShieldCheck,
  Sliders,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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

// ─── Navigation structure ─────────────────────────────────────────────────────
// Mirrors the 5 semantic groups on /dashboard/admin:
// 1. Overview
// 2. Platformas noteikumi  — rules of the game (config, catalog)
// 3. Dalībnieku pārvaldība — who is allowed to play
// 4. Operacionālā triāža   — needs human action today
// 5. Finanses              — money flows
// 6. Pārraudzība           — read-only observability

const ADMIN_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Pārskats',
    items: [{ label: 'Vadības panelis', href: '/dashboard/admin', icon: LayoutDashboard }],
  },
  {
    id: 'rules',
    label: 'Platformas noteikumi',
    items: [
      { label: 'Katalogs', href: '/dashboard/admin/catalog', icon: Package },
      { label: 'Konfigurācija', href: '/dashboard/admin/config', icon: Sliders },
    ],
  },
  {
    id: 'governance',
    label: 'Dalībnieku pārvaldība',
    items: [
      {
        label: 'Pieteikumi',
        href: '/dashboard/admin/applications',
        icon: ShieldCheck,
        badgeKey: 'pendingApplications',
      },
      { label: 'Lietotāji', href: '/dashboard/admin/users', icon: Users },
      { label: 'Uzņēmumi', href: '/dashboard/admin/companies', icon: Building2 },
      { label: 'Piegādātāji', href: '/dashboard/admin/suppliers', icon: Layers },
      { label: 'Pārstrādes centri', href: '/dashboard/admin/recycling-centers', icon: Recycle },
      { label: 'Lauka operācijas', href: '/dashboard/admin/field-ops', icon: MapPin },
    ],
  },
  {
    id: 'triage',
    label: 'Operacionālā triāža',
    items: [
      {
        label: 'Triāža',
        href: '/dashboard/admin/triage',
        icon: AlertTriangle,
        badgeKey: 'triageAlerts',
      },
      {
        label: 'Dokumenti',
        href: '/dashboard/admin/documents',
        icon: FileText,
      },
      { label: 'Paziņojumu izsūtīšana', href: '/dashboard/admin/broadcast', icon: Megaphone },
    ],
  },
  {
    id: 'finance',
    label: 'Finanses',
    items: [{ label: 'Finanses', href: '/dashboard/admin/finances', icon: Wallet }],
  },
  {
    id: 'observability',
    label: 'Pārraudzība',
    items: [
      { label: 'Visi pasūtījumi', href: '/dashboard/admin/orders', icon: BarChart3 },
      { label: 'Transporta darbi', href: '/dashboard/admin/jobs', icon: Truck },
      { label: 'Tirgus piedāvājumi', href: '/dashboard/admin/marketplace', icon: ListChecks },
      { label: 'RFQ pieprasījumi', href: '/dashboard/admin/rfqs', icon: ClipboardList },
      { label: 'Pamatlīgumi', href: '/dashboard/admin/framework-contracts', icon: ScrollText },
      { label: 'Audita žurnāls', href: '/dashboard/admin/audit-logs', icon: ScrollText },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [badges, setBadges] = React.useState<AdminBadges>({
    notifications: 0,
    pendingApplications: 0,
    openDisputes: 0,
    openSupport: 0,
    openExceptions: 0,
    activeJobs: 0,
    triageAlerts: 0,
  });

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/dashboard/admin') return pathname === href;
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  // Live badge refresh
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
    <Sidebar collapsible="icon" {...props}>
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Admin">
              <Link href="/dashboard/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-900 text-white shrink-0 relative">
                  <ShieldCheck className="size-4" />
                  {totalAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold group-data-[collapsible=icon]:flex">
                      {totalAlerts > 9 ? '!' : totalAlerts}
                    </span>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">B3Hub Admin</span>
                  <span className="truncate text-xs text-gray-500">Platformas pārvaldība</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav sections */}
      <SidebarContent>
        {ADMIN_NAV.map((section) => (
          <SidebarGroup key={section.id} className="pt-2">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider pb-1">
              {section.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = isActive(item.href);
                const count = item.badgeKey ? badges[item.badgeKey] : 0;
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
