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

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

const ROLE_NAV: Record<Mode, NavSection[]> = {
  BUYER: [
    {
      id: 'buyer-main',
      label: 'Galvenā',
      icon: LayoutDashboard,
      items: [{ label: 'Sākumlapa', href: '/dashboard/buyer', icon: LayoutDashboard }],
    },
    {
      id: 'buyer-orders',
      label: 'Pasūtījumi',
      icon: ClipboardList,
      items: [
        { label: 'Mani Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Regulārie Pasūtījumi', href: '/dashboard/orders/schedules', icon: CalendarClock },
        { label: 'Piegāžu Grafiks', href: '/dashboard/deliveries', icon: CalendarDays },
        { label: 'Skip Noma', href: '/dashboard/order/skip-hire', icon: Box },
        { label: 'Mani Strīdi', href: '/dashboard/disputes', icon: AlertTriangle },
      ],
    },
    {
      id: 'buyer-procurement',
      label: 'Iepirkumi',
      icon: FolderKanban,
      items: [
        { label: 'Pasūtīt Materiālus', href: '/dashboard/catalog', icon: Package },
        { label: 'Ietvarlīgumi', href: '/dashboard/framework-contracts', icon: FolderKanban },
        { label: 'Caurlaides', href: '/dashboard/field-passes', icon: Ticket },
      ],
    },
    {
      id: 'buyer-finance',
      label: 'Finanses',
      icon: Receipt,
      items: [
        { label: 'Rēķini', href: '/dashboard/invoices', icon: Receipt },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
      ],
    },
  ],
  SUPPLIER: [
    {
      id: 'supplier-workspace',
      label: 'Mani Materiāli un Pasūtījumi',
      icon: LayoutGrid,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/supplier', icon: LayoutDashboard },
        { label: 'Mani Materiāli', href: '/dashboard/materials', icon: Package },
        { label: 'Ienākošie Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Piegāžu Grafiks', href: '/dashboard/deliveries', icon: CalendarDays },
        { label: 'Pieprasījumu Tirgus', href: '/dashboard/quote-requests/open', icon: Search },
      ],
    },
    {
      id: 'supplier-business',
      label: 'Finanses',
      icon: Banknote,
      items: [
        { label: 'Ieņēmumi', href: '/dashboard/earnings', icon: Banknote },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Atsauksmes', href: '/dashboard/reviews', icon: Star },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
      ],
    },
  ],
  CARRIER: [
    {
      id: 'carrier-jobs',
      label: 'Darbi',
      icon: Briefcase,
      items: [
        { label: 'Sākumlapa', href: '/dashboard/transporter', icon: LayoutDashboard },
        { label: 'Darbu Tirgus', href: '/dashboard/jobs', icon: Briefcase },
        { label: 'Piegāžu Grafiks', href: '/dashboard/deliveries', icon: CalendarDays },
        { label: 'Utilizācijas Centri', href: '/dashboard/recycling-centers', icon: Recycle },
      ],
    },
    {
      id: 'carrier-fleet',
      label: 'Flote',
      icon: Car,
      items: [
        { label: 'Flotes Pārvaldība', href: '/dashboard/fleet-management', icon: LayoutGrid },
      ],
    },
    {
      id: 'carrier-business',
      label: 'Finanses un Dokumenti',
      icon: Banknote,
      items: [
        { label: 'Ienākumi', href: '/dashboard/earnings', icon: Banknote },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
      ],
    },
  ],
};

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
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
    (href: string) => {
      if (PARENT_NAV_HREFS.has(href)) return pathname === href;
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

    if (activeMode === 'BUYER') {
      // All buyers get the project tracker
      sections = sections.map((section) => {
        if (section.id !== 'buyer-procurement') return section;
        return {
          ...section,
          items: [
            ...section.items,
            { label: 'Projekti', href: '/dashboard/projects', icon: FolderKanban },
          ],
        };
      });
    }

    if (activeMode === 'CARRIER') {
      const isDispatcher =
        user?.isCompany && (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER');

      const isCompanyDriver =
        user?.isCompany && (user.companyRole === 'DRIVER' || user.companyRole === 'MEMBER');

      if (isDispatcher) {
        // Inject Dispatcher Panel for company owners/managers only
        sections = sections.map((section) => {
          if (section.id !== 'carrier-jobs') return section;
          return {
            ...section,
            items: [
              section.items[0],
              { label: 'Dispečera Panelis', href: '/dashboard/active', icon: LayoutGrid },
              ...section.items.slice(1),
            ],
          };
        });
      }

      if (isCompanyDriver) {
        // Company drivers are field workers — hide dispatcher-only management screens
        // and the job marketplace (they accept jobs on mobile, not desktop)
        sections = sections.map((section) => {
          if (section.id === 'carrier-jobs') {
            return {
              ...section,
              items: section.items.filter(
                (item) => item.href !== '/dashboard/transporter' && item.href !== '/dashboard/jobs',
              ),
            };
          }
          return section;
        });
      }

      if (!isDispatcher) {
        // Non-dispatcher carrier users without a DRIVER companyRole get the fleet control tower link
        // DRIVER role users are redirected away from /active, so don't show the link to them
        if (user?.companyRole !== 'DRIVER') {
          sections = sections.map((section) => {
            if (section.id !== 'carrier-jobs') return section;
            const dashboardItem = section.items[0];
            return {
              ...section,
              items: [
                dashboardItem,
                { label: 'Aktīvais Darbs', href: '/dashboard/active', icon: MapPin },
                ...section.items.slice(1),
              ],
            };
          });
        }
      }
    }

    if (activeMode === 'CARRIER' && user?.canSkipHire) {
      // Skip-hire operators get the operator settings link
      sections = sections.map((section) => {
        if (section.id !== 'carrier-fleet') return section;
        return {
          ...section,
          items: [
            ...section.items,
            {
              label: 'Operatora Iestatījumi',
              href: '/dashboard/transporter/settings',
              icon: Settings,
            },
          ],
        };
      });
    }

    if (activeMode === 'SUPPLIER' && !user?.isCompany) {
      // Individual (non-company) suppliers have no company reviews — hide the Reviews link
      sections = sections.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.href !== '/dashboard/reviews'),
      }));
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
              <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider pb-1">
                {section.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = isRouteActive(item.href);
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isActive}
                        className="font-medium text-gray-600 hover:text-gray-900"
                      >
                        <Link href={item.href}>
                          <item.icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                          {renderBadge(itemBadgeCountByHref[item.href] ?? 0)}
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
                  isActive={isRouteActive('/dashboard/notifications')}
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
                  isActive={isRouteActive('/dashboard/chat')}
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
