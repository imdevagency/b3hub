/**
 * App sidebar component.
 * Role-aware navigation sidebar showing different items for BUYER / SUPPLIER /
 * CARRIER / ADMIN. Built with shadcn/ui Sidebar primitives.
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Box,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  FileQuestion,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Percent,
  Radio,
  Recycle,
  Package,
  PackagePlus,
  Receipt,
  Search,
  Settings,
  ScrollText,
  ShieldCheck,
  Star,
  Ticket,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { useMode, type Mode } from '@/lib/mode-context';
import { PORTAL_NAV_GROUPS, getGroupPaths } from '@/lib/portal-nav-groups';
import {
  getAllTransportJobs,
  getMyOrders,
  getMyTransportJobs,
  getOpenQuoteRequests,
  getProviderApplications,
  getUnreadNotificationCount,
  listDisputes,
} from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** All paths in this group — sidebar item stays active on any of them */
  groupPaths?: string[];
  badgeKey?: keyof SidebarBadgeCounts;
};
type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

// ── Sidebar nav — one item per business domain (max 6 per role). ─────────────
// Sub-pages within each domain appear as tab strips (PortalSectionTabs).
// groupPaths keeps the sidebar item highlighted on all sibling pages.

const ROLE_NAV: Record<Mode, NavSection[]> = {
  BUYER: [
    {
      id: 'buyer-main',
      label: '',
      icon: LayoutDashboard,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/buyer', icon: LayoutDashboard },
        {
          label: 'Pasūtījumi',
          href: '/dashboard/orders',
          icon: ClipboardList,
          groupPaths: getGroupPaths('BUYER', 'orders'),
        },
        {
          label: 'Iepirkumi',
          href: '/dashboard/catalog',
          icon: Package,
          groupPaths: getGroupPaths('BUYER', 'procurement'),
        },
        {
          label: 'Finanses',
          href: '/dashboard/invoices',
          icon: Receipt,
          groupPaths: getGroupPaths('BUYER', 'finance'),
        },
      ],
    },
  ],
  SUPPLIER: [
    {
      id: 'supplier-main',
      label: '',
      icon: LayoutDashboard,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/supplier', icon: LayoutDashboard },
        {
          label: 'Darbi',
          href: '/dashboard/orders',
          icon: ClipboardList,
          groupPaths: getGroupPaths('SUPPLIER', 'work'),
        },
        {
          label: 'Katalogs',
          href: '/dashboard/materials',
          icon: Package,
          groupPaths: getGroupPaths('SUPPLIER', 'catalog'),
        },
        {
          label: 'Finanses',
          href: '/dashboard/earnings',
          icon: Banknote,
          groupPaths: getGroupPaths('SUPPLIER', 'finance'),
        },
      ],
    },
  ],
  CARRIER: [
    {
      id: 'carrier-main',
      label: '',
      icon: LayoutDashboard,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/transporter', icon: LayoutDashboard },
        {
          label: 'Darbi',
          href: '/dashboard/jobs',
          icon: Briefcase,
          groupPaths: getGroupPaths('CARRIER', 'work'),
          badgeKey: 'activeJobs',
        },
        {
          label: 'Flote',
          href: '/dashboard/fleet-management',
          icon: Car,
          groupPaths: getGroupPaths('CARRIER', 'fleet'),
        },
        {
          label: 'Finanses',
          href: '/dashboard/earnings',
          icon: Banknote,
          groupPaths: getGroupPaths('CARRIER', 'finance'),
        },
      ],
    },
  ],
  CONSTRUCTION: [
    {
      id: 'construction-main',
      label: '',
      icon: LayoutDashboard,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/construction', icon: LayoutDashboard },
        {
          label: 'Projekti',
          href: '/dashboard/projects',
          icon: FolderKanban,
          groupPaths: getGroupPaths('CONSTRUCTION', 'projects'),
        },
        {
          label: 'Finanses',
          href: '/dashboard/invoices',
          icon: Receipt,
          groupPaths: getGroupPaths('CONSTRUCTION', 'finance'),
        },
      ],
    },
  ],
  RECYCLER: [
    {
      id: 'recycler-main',
      label: '',
      icon: LayoutDashboard,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/recycling', icon: LayoutDashboard },
        {
          label: 'Darbi',
          href: '/dashboard/recycling/jobs',
          icon: Recycle,
          groupPaths: getGroupPaths('RECYCLER', 'work'),
        },
        {
          label: 'Dokumenti',
          href: '/dashboard/documents',
          icon: FolderOpen,
          groupPaths: getGroupPaths('RECYCLER', 'docs'),
        },
      ],
    },
  ],
};

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
  CONSTRUCTION: '/dashboard/construction',
  RECYCLER: '/dashboard/recycling',
};

// Routes that are parents of other nav routes — use exact match only to avoid
// double-highlighting parent + child when a sub-route is active.
const _ALL_NAV_HREFS = Object.values(ROLE_NAV).flatMap((sections) =>
  sections.flatMap((s) => s.items.map((i) => i.href)),
);
const PARENT_NAV_HREFS = new Set(
  _ALL_NAV_HREFS.filter((href) =>
    _ALL_NAV_HREFS.some((other) => other !== href && other.startsWith(`${href}/`)),
  ),
);

const MODE_LABEL: Record<Mode, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
  CONSTRUCTION: 'Celtniecība',
  RECYCLER: 'Pārstrāde',
};

const ACTIVE_JOB_STATUSES = new Set([
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

type SidebarBadgeCounts = {
  notifications: number;
  openRfqs: number;
  activeJobs: number;
  openDisputes: number;
  pendingApplications: number;
  pendingSellerOrders: number;
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, token, logout } = useAuth();
  const { activeMode, setActiveMode, availableModes } = useMode();
  const router = useRouter();
  const pathname = usePathname();
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>({
    notifications: 0,
    openRfqs: 0,
    activeJobs: 0,
    openDisputes: 0,
    pendingApplications: 0,
    pendingSellerOrders: 0,
  });

  const isRouteActive = React.useCallback(
    (item: NavItem) => {
      const { href } = item;
      // Exact match for home/root pages
      if (
        href === '/dashboard/buyer' ||
        href === '/dashboard/supplier' ||
        href === '/dashboard/transporter' ||
        href === '/dashboard/construction' ||
        href === '/dashboard/recycling'
      ) {
        return pathname === href;
      }
      // Group-aware: highlight when on any tab within the domain
      if (item.groupPaths && item.groupPaths.length > 0) {
        return item.groupPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
      }
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const navSections = React.useMemo(() => {
    if (user?.userType === 'ADMIN') return [];
    const base = ROLE_NAV[activeMode];
    let sections: NavSection[] = base.map((section) => ({
      ...section,
      items: [...section.items],
    }));

    if (activeMode === 'CARRIER') {
      const isDispatcher =
        user?.isCompany && (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER');
      const isCompanyDriver =
        user?.isCompany && (user.companyRole === 'DRIVER' || user.companyRole === 'MEMBER');

      if (isDispatcher) {
        // Dispatcher: insert dispatcher panel right after home
        sections = sections.map((section) => {
          if (section.id !== 'carrier-main') return section;
          const [home, ...rest] = section.items;
          return {
            ...section,
            items: [
              home,
              { label: 'Dispečera Panelis', href: '/dashboard/active', icon: LayoutGrid },
              ...rest,
            ],
          };
        });
      } else if (user?.companyRole !== 'DRIVER') {
        // Non-dispatcher, non-field driver: add active job monitor
        sections = sections.map((section) => {
          if (section.id !== 'carrier-main') return section;
          const [home, ...rest] = section.items;
          return {
            ...section,
            items: [
              home,
              { label: 'Aktīvais Darbs', href: '/dashboard/active', icon: MapPin },
              ...rest,
            ],
          };
        });
      }

      if (isCompanyDriver) {
        // Field drivers: remove home dashboard + job marketplace sidebar items
        sections = sections.map((section) => ({
          ...section,
          items: section.items.filter(
            (item) => item.href !== '/dashboard/transporter' && item.href !== '/dashboard/jobs',
          ),
        }));
      }
    }

    return sections;
  }, [activeMode, user]);

  React.useEffect(() => {
    if (!token) {
      setBadgeCounts({
        notifications: 0,
        openRfqs: 0,
        activeJobs: 0,
        openDisputes: 0,
        pendingApplications: 0,
        pendingSellerOrders: 0,
      });
      return;
    }

    let cancelled = false;

    const loadBadgeCounts = async () => {
      const [
        notificationsResult,
        rfqResult,
        activeJobsResult,
        disputesResult,
        applicationsResult,
        pendingSellerResult,
      ] = await Promise.allSettled([
        getUnreadNotificationCount(token),
        activeMode === 'SUPPLIER' ? getOpenQuoteRequests(token) : Promise.resolve([]),
        activeMode === 'CARRIER'
          ? (async () => {
              const canDispatchCarrierJobs =
                user?.userType === 'ADMIN' ||
                user?.companyRole === 'OWNER' ||
                user?.companyRole === 'MANAGER' ||
                !!user?.permManageOrders ||
                (!!user?.canTransport && !!user?.isCompany);

              const jobs = canDispatchCarrierJobs
                ? await getAllTransportJobs(token)
                : await getMyTransportJobs(token);

              return jobs.filter((job) => ACTIVE_JOB_STATUSES.has(job.status)).length;
            })()
          : Promise.resolve(0),
        user?.userType === 'ADMIN'
          ? listDisputes(token).then(
              (ds) => ds.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW').length,
            )
          : Promise.resolve(0),
        user?.userType === 'ADMIN'
          ? getProviderApplications(token, 'PENDING').then((apps) => apps.length)
          : Promise.resolve(0),
        activeMode === 'SUPPLIER' && user?.canSell
          ? getMyOrders(token, 'PENDING').then((orders) => orders.length)
          : Promise.resolve(0),
      ]);

      if (cancelled) return;

      setBadgeCounts({
        notifications:
          notificationsResult.status === 'fulfilled'
            ? Math.max(0, notificationsResult.value.count ?? 0)
            : 0,
        openRfqs: rfqResult.status === 'fulfilled' ? Math.max(0, rfqResult.value.length) : 0,
        activeJobs:
          activeJobsResult.status === 'fulfilled' ? Math.max(0, activeJobsResult.value) : 0,
        openDisputes: disputesResult.status === 'fulfilled' ? Math.max(0, disputesResult.value) : 0,
        pendingApplications:
          applicationsResult.status === 'fulfilled' ? Math.max(0, applicationsResult.value) : 0,
        pendingSellerOrders:
          pendingSellerResult.status === 'fulfilled' ? Math.max(0, pendingSellerResult.value) : 0,
      });
    };

    loadBadgeCounts();
    const intervalId = window.setInterval(loadBadgeCounts, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeMode,
    token,
    user?.canSell,
    user?.canTransport,
    user?.companyRole,
    user?.isCompany,
    user?.permManageOrders,
    user?.userType,
  ]);

  const itemBadgeCountByHref = React.useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {
      '/dashboard/notifications': badgeCounts.notifications,
      '/dashboard/quote-requests/open': badgeCounts.openRfqs,
      '/dashboard/incoming-orders': badgeCounts.pendingSellerOrders,
    };

    if (activeMode === 'CARRIER') {
      map['/dashboard/jobs'] = badgeCounts.activeJobs;
    }

    if (badgeCounts.openDisputes > 0) {
      map['/dashboard/admin/disputes'] = badgeCounts.openDisputes;
    }

    return map;
  }, [
    activeMode,
    badgeCounts.activeJobs,
    badgeCounts.notifications,
    badgeCounts.openRfqs,
    badgeCounts.openDisputes,
    badgeCounts.pendingSellerOrders,
  ]);

  const renderBadge = React.useCallback((count: number) => {
    if (count <= 0) return null;
    const display = count > 99 ? '99+' : String(count);
    return (
      <Badge
        variant="secondary"
        className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px] leading-none group-data-[collapsible=icon]:hidden"
      >
        {display}
      </Badge>
    );
  }, []);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="B3Hub">
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-900 text-white shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">B3Hub</span>
                  <span className="truncate text-xs text-gray-500">
                    {user?.userType === 'ADMIN' ? 'Administrācija' : MODE_LABEL[activeMode]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {availableModes.length > 1 && (
          <div className="px-2 pb-2 flex gap-1 group-data-[collapsible=icon]:hidden">
            {availableModes.map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setActiveMode(mode);
                  router.push(ROLE_HOME[mode]);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  activeMode === mode
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Primary CTA — hidden for admins */}
        <div className="px-3 pt-4 pb-3 group-data-[collapsible=icon]:hidden">
          {user?.userType !== 'ADMIN' && activeMode === 'BUYER' && (
            <SidebarMenuButton
              asChild
              className="bg-gray-900 text-white hover:bg-gray-800 hover:text-white w-full justify-center shadow font-semibold h-10"
            >
              <Link href="/dashboard/order">
                <PackagePlus className="mr-2 size-4" />
                Jauns Pasūtījums
              </Link>
            </SidebarMenuButton>
          )}
          {user?.userType !== 'ADMIN' && activeMode === 'SUPPLIER' && (
            <SidebarMenuButton
              asChild
              className="bg-gray-900 text-white hover:bg-gray-800 hover:text-white w-full justify-center shadow font-semibold h-10"
            >
              <Link href="/dashboard/materials?new=true">
                <PackagePlus className="mr-2 size-4" />
                Pievienot Materiālu
              </Link>
            </SidebarMenuButton>
          )}
          {user?.userType !== 'ADMIN' && activeMode === 'CARRIER' && (
            <SidebarMenuButton
              asChild
              className="bg-gray-900 text-white hover:bg-gray-800 hover:text-white w-full justify-center shadow font-semibold h-10"
            >
              <Link href="/dashboard/jobs">
                <PackagePlus className="mr-2 size-4" />
                Meklēt Darbu
              </Link>
            </SidebarMenuButton>
          )}
        </div>

        {/* Role nav sections — hidden for admins */}
        {user?.userType !== 'ADMIN' &&
          navSections.map((section) => (
            <SidebarGroup key={section.id} className="pt-2">
              {section.label && (
                <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider pb-1">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = isRouteActive(item);
                  const badgeCount = item.badgeKey
                    ? badgeCounts[item.badgeKey]
                    : (itemBadgeCountByHref[item.href] ?? 0);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isActive}
                        className="font-medium text-gray-600 hover:text-gray-900"
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                          {renderBadge(badgeCount)}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}

        {/* Saziņa — always visible for non-admin */}
        {user?.userType !== 'ADMIN' && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider pb-1">
              Saziņa
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Paziņojumi"
                  isActive={isRouteActive({
                    href: '/dashboard/notifications',
                    label: 'Paziņojumi',
                    icon: Bell,
                  })}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  <Link href="/dashboard/notifications">
                    <Bell className="size-4 shrink-0" />
                    <span>Paziņojumi</span>
                    {renderBadge(badgeCounts.notifications)}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Ziņojumi"
                  isActive={isRouteActive({
                    href: '/dashboard/chat',
                    label: 'Ziņojumi',
                    icon: MessageSquare,
                  })}
                  className="font-medium text-gray-600 hover:text-gray-900"
                >
                  <Link href="/dashboard/chat">
                    <MessageSquare className="size-4 shrink-0" />
                    <span>Ziņojumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Admin section */}
        {user?.userType === 'ADMIN' && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
              Administrācija
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Pārskats"
                  isActive={isRouteActive('/dashboard/admin')}
                >
                  <Link href="/dashboard/admin">
                    <LayoutDashboard className="size-4 shrink-0" />
                    <span>Pārskats</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Lietotāji"
                  isActive={isRouteActive('/dashboard/admin/users')}
                >
                  <Link href="/dashboard/admin/users">
                    <Users className="size-4 shrink-0" />
                    <span>Lietotāji</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Uzņēmumi"
                  isActive={isRouteActive('/dashboard/admin/companies')}
                >
                  <Link href="/dashboard/admin/companies">
                    <Building2 className="size-4 shrink-0" />
                    <span>Uzņēmumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Pasūtījumi"
                  isActive={isRouteActive('/dashboard/admin/orders')}
                >
                  <Link href="/dashboard/admin/orders">
                    <ClipboardList className="size-4 shrink-0" />
                    <span>Pasūtījumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Transporta darbi"
                  isActive={isRouteActive('/dashboard/admin/jobs')}
                >
                  <Link href="/dashboard/admin/jobs">
                    <Truck className="size-4 shrink-0" />
                    <span>Transporta darbi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Pieteikumi"
                  isActive={isRouteActive('/dashboard/admin/applications')}
                >
                  <Link href="/dashboard/admin/applications">
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>Pieteikumi</span>
                    {renderBadge(badgeCounts.pendingApplications)}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Sūdzības"
                  isActive={isRouteActive('/dashboard/admin/disputes')}
                >
                  <Link href="/dashboard/admin/disputes">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Sūdzības</span>
                    {renderBadge(badgeCounts.openDisputes)}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Atbalsta iesūtne"
                  isActive={isRouteActive('/dashboard/admin/support')}
                >
                  <Link href="/dashboard/admin/support">
                    <MessageSquare className="size-4 shrink-0" />
                    <span>Atbalsts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Materiālu katalogs"
                  isActive={isRouteActive('/dashboard/admin/materials')}
                >
                  <Link href="/dashboard/admin/materials">
                    <Package className="size-4 shrink-0" />
                    <span>Materiāli</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Audita žurnāls"
                  isActive={isRouteActive('/dashboard/admin/audit-logs')}
                >
                  <Link href="/dashboard/admin/audit-logs">
                    <ScrollText className="size-4 shrink-0" />
                    <span>Audita žurnāls</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Maksājumu rinda"
                  isActive={isRouteActive('/dashboard/admin/payments')}
                >
                  <Link href="/dashboard/admin/payments">
                    <Banknote className="size-4 shrink-0" />
                    <span>Maksājumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="SLA monitors"
                  isActive={isRouteActive('/dashboard/admin/sla')}
                >
                  <Link href="/dashboard/admin/sla">
                    <Clock className="size-4 shrink-0" />
                    <span>SLA monitors</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Piemaksu apstiprināšana"
                  isActive={isRouteActive('/dashboard/admin/surcharges')}
                >
                  <Link href="/dashboard/admin/surcharges">
                    <Receipt className="size-4 shrink-0" />
                    <span>Piemaksas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Piegādātāju veiktspēja"
                  isActive={isRouteActive('/dashboard/admin/suppliers')}
                >
                  <Link href="/dashboard/admin/suppliers">
                    <BarChart3 className="size-4 shrink-0" />
                    <span>Piegādātāji</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Platformas dokumentācija"
                  isActive={isRouteActive('/dashboard/admin/documentation')}
                >
                  <Link href="/dashboard/admin/documentation">
                    <FileQuestion className="size-4 shrink-0" />
                    <span>Dokumentācija</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="B3 Fields"
                  isActive={isRouteActive('/dashboard/admin/b3-fields')}
                >
                  <Link href="/dashboard/admin/b3-fields">
                    <MapPin className="size-4 shrink-0" />
                    <span>B3 Fields</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Field Passes"
                  isActive={isRouteActive('/dashboard/admin/field-passes')}
                >
                  <Link href="/dashboard/admin/field-passes">
                    <Ticket className="size-4 shrink-0" />
                    <span>Field Passes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Skip noma (admin)"
                  isActive={isRouteActive('/dashboard/admin/skip-hire')}
                >
                  <Link href="/dashboard/admin/skip-hire">
                    <Box className="size-4 shrink-0" />
                    <span>Skip Noma</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Incidenti"
                  isActive={isRouteActive('/dashboard/admin/exceptions')}
                >
                  <Link href="/dashboard/admin/exceptions">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Incidenti</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Rēķini (admin)"
                  isActive={isRouteActive('/dashboard/admin/invoices')}
                >
                  <Link href="/dashboard/admin/invoices">
                    <Receipt className="size-4 shrink-0" />
                    <span>Rēķini</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Ietvarlīgumi (admin)"
                  isActive={isRouteActive('/dashboard/admin/framework-contracts')}
                >
                  <Link href="/dashboard/admin/framework-contracts">
                    <FolderKanban className="size-4 shrink-0" />
                    <span>Ietvarlīgumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Izmaksas"
                  isActive={isRouteActive('/dashboard/admin/payouts')}
                >
                  <Link href="/dashboard/admin/payouts">
                    <Wallet className="size-4 shrink-0" />
                    <span>Izmaksas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Komisijas likmes"
                  isActive={isRouteActive('/dashboard/admin/fee-config')}
                >
                  <Link href="/dashboard/admin/fee-config">
                    <Percent className="size-4 shrink-0" />
                    <span>Komisijas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Sūtīt paziņojumu"
                  isActive={isRouteActive('/dashboard/admin/broadcast')}
                >
                  <Link href="/dashboard/admin/broadcast">
                    <Radio className="size-4 shrink-0" />
                    <span>Broadcast</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Platformas iestatījumi"
                  isActive={isRouteActive('/dashboard/admin/settings')}
                >
                  <Link href="/dashboard/admin/settings">
                    <Settings className="size-4 shrink-0" />
                    <span>Iestatījumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Account */}
        <SidebarGroup className="mt-auto pt-2 pb-2">
          <SidebarMenu>
            {user?.isCompany && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Uzņēmuma profils"
                    isActive={isRouteActive('/dashboard/company')}
                  >
                    <Link href="/dashboard/company">
                      <Building2 className="size-4 shrink-0" />
                      <span>Uzņēmuma profils</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {(user.companyRole === 'OWNER' || user.companyRole === 'MANAGER') && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Komanda"
                      isActive={isRouteActive('/dashboard/company/team')}
                    >
                      <Link href="/dashboard/company/team">
                        <Users className="size-4 shrink-0" />
                        <span>Uzņēmuma komanda</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Iestatījumi"
                isActive={isRouteActive('/dashboard/settings')}
              >
                <Link href="/dashboard/settings">
                  <Settings className="size-4 shrink-0" />
                  <span>Personīgie Iestatījumi</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* User + sign out */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="cursor-default hover:bg-transparent"
              tooltip={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
            >
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                {user?.avatar && <AvatarImage src={user.avatar} alt={initials} />}
                <AvatarFallback className="rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="truncate text-xs text-gray-500">{user?.email}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Iziet"
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              <LogOut />
              <span>Iziet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
