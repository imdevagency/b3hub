/**
 * AdminSidebar — dedicated sidebar for ADMIN users.
 *
 * Shown instead of AppSidebar when user.userType === 'ADMIN'.
 * Three top-level scopes: B3Hub (marketplace), B3 Recycling, B3 Construction.
 * Scope is detected from the current URL pathname.
 * B3Hub sections have live badge counts refreshed every 30 s.
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Box,
  Building2,
  ClipboardList,
  FileText,
  Globe2,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  Navigation,
  Package,
  Recycle,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { getAdminStats, getUnreadNotificationCount } from '@/lib/api';
import { adminListSupportThreads } from '@/lib/api/support';
import { adminGetExceptions, adminGetGuestOrders } from '@/lib/api/admin';
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
  pendingGuestOrders: number;
};

// ─── Business unit definitions ────────────────────────────────────────────────

type Scope = 'group' | 'b3hub';

const BUSINESS_UNITS: { id: Scope; label: string; href: string }[] = [
  { id: 'group', label: 'Grupa', href: '/dashboard/group' },
  { id: 'b3hub', label: 'APP', href: '/dashboard/admin' },
];

// ─── B3 Group navigation (cross-BU overview) ────────────────────────────────

const GROUP_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Pārskats',
    items: [{ label: 'Grupas pārskats', href: '/dashboard/group', icon: Globe2 }],
  },
];

// ─── B3Hub navigation (marketplace admin) ────────────────────────────────────

const B3HUB_NAV: NavSection[] = [
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
      { label: 'Sistēmas iestatījumi', href: '/dashboard/admin/settings', icon: Settings2 },
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
      { label: 'B3 Lauki', href: '/dashboard/admin/b3-fields', icon: MapPin },
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
      { label: 'Dokumenti', href: '/dashboard/admin/documents', icon: FileText },
      {
        label: 'Viesa pasūtījumi',
        href: '/dashboard/admin/guest-orders',
        icon: ShoppingBag,
        badgeKey: 'pendingGuestOrders',
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
      { label: 'Dispečerizācija', href: '/dashboard/admin/dispatch', icon: Navigation },
      { label: 'Visi pasūtījumi', href: '/dashboard/admin/orders', icon: BarChart3 },
      { label: 'Transporta darbi', href: '/dashboard/admin/jobs', icon: Truck },
      { label: 'Skip Hire', href: '/dashboard/admin/skip-hire', icon: Box },
      { label: 'Tirgus piedāvājumi', href: '/dashboard/admin/marketplace', icon: ListChecks },
      { label: 'RFQ pieprasījumi', href: '/dashboard/admin/rfqs', icon: ClipboardList },
      { label: 'Pamatlīgumi', href: '/dashboard/admin/framework-contracts', icon: ScrollText },
      { label: 'Audita žurnāls', href: '/dashboard/admin/audit-logs', icon: ScrollText },
    ],
  },
];

// ─── B3 Recycling navigation ──────────────────────────────────────────────────

// ─── Scope icon map ───────────────────────────────────────────────────────────

const SCOPE_ICON: Record<Scope, React.ElementType> = {
  group: Globe2,
  b3hub: ShieldCheck,
};

const SCOPE_SUBTITLE: Record<Scope, string> = {
  group: 'B3 Grupas pārskats',
  b3hub: 'Platformas pārvaldība',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Detect active scope from URL
  const activeScope: Scope =
    pathname === '/dashboard/group' || pathname.startsWith('/dashboard/group/') ? 'group' : 'b3hub';

  const activeNav = activeScope === 'group' ? GROUP_NAV : B3HUB_NAV;

  const ScopeIcon = SCOPE_ICON[activeScope];

  const [badges, setBadges] = React.useState<AdminBadges>({
    notifications: 0,
    pendingApplications: 0,
    openDisputes: 0,
    openSupport: 0,
    openExceptions: 0,
    activeJobs: 0,
    triageAlerts: 0,
    pendingGuestOrders: 0,
  });

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/dashboard/admin' || href === '/dashboard/group') {
        return pathname === href;
      }
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  // Live badge refresh — only runs for B3Hub scope (where badges are meaningful)
  React.useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      const [statsRes, notifRes, supportRes, exceptionsRes, guestOrdersRes] =
        await Promise.allSettled([
          getAdminStats(token),
          getUnreadNotificationCount(token),
          adminListSupportThreads(token),
          adminGetExceptions(token, 'OPEN'),
          adminGetGuestOrders(token, 'PENDING'),
        ]);

      if (cancelled) return;

      const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
      const notif = notifRes.status === 'fulfilled' ? notifRes.value : null;
      const support = supportRes.status === 'fulfilled' ? supportRes.value : [];
      const exceptions = exceptionsRes.status === 'fulfilled' ? exceptionsRes.value : [];
      const guestOrders = guestOrdersRes.status === 'fulfilled' ? guestOrdersRes.value : [];

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
        pendingGuestOrders: Math.max(0, guestOrders.length),
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
      {/* Brand + scope icon */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Admin">
              <Link href={BUSINESS_UNITS.find((u) => u.id === activeScope)!.href}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-900 text-white shrink-0 relative">
                  <ScopeIcon className="size-4" />
                  {activeScope === 'b3hub' && totalAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold group-data-[collapsible=icon]:flex">
                      {totalAlerts > 9 ? '!' : totalAlerts}
                    </span>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">B3 Group Admin</span>
                  <span className="truncate text-xs text-gray-500">
                    {SCOPE_SUBTITLE[activeScope]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Business unit switcher — hidden when sidebar is collapsed to icon */}
        <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="flex rounded-lg bg-gray-100 p-0.5 gap-0.5">
            {BUSINESS_UNITS.map((unit) => (
              <Link
                key={unit.id}
                href={unit.href}
                className={cn(
                  'flex-1 text-center rounded-md px-1 py-1.5 text-[10px] font-semibold transition-all leading-none',
                  activeScope === unit.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {unit.label}
              </Link>
            ))}
          </div>
        </div>
      </SidebarHeader>

      {/* Nav sections — scoped per business unit */}
      <SidebarContent>
        {activeNav.map((section) => (
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
