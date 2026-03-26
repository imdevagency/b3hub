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
  Award,
  Banknote,
  BarChart3,
  Bell,
  Box,
  Briefcase,
  Building2,
  CalendarClock,
  Car,
  ClipboardList,
  Clock3,
  FileQuestion,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Recycle,
  Package,
  PackagePlus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { useMode, type Mode } from '@/lib/mode-context';
import {
  getAllTransportJobs,
  getMyTransportJobs,
  getOpenQuoteRequests,
  getUnreadNotificationCount,
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
  SidebarMenuAction,
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

const MAX_RECENT_ITEMS = 4;

const ROLE_NAV: Record<Mode, NavSection[]> = {
  BUYER: [
    {
      id: 'buyer-workspace',
      label: 'Darbvieta',
      icon: LayoutGrid,
      items: [
        { label: 'Informācijas Panelis', href: '/dashboard/buyer', icon: LayoutDashboard },
        { label: 'Materiālu Katalogs', href: '/dashboard/catalog', icon: Package },
      ],
    },
    {
      id: 'buyer-orders',
      label: 'Pasūtījumi',
      icon: ClipboardList,
      items: [
        { label: 'Mani Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Projekti', href: '/dashboard/framework-contracts', icon: FolderKanban },
        { label: 'Cenu Pieprasījumi', href: '/dashboard/quote-requests', icon: FileQuestion },
        { label: 'Konteineri', href: '/dashboard/containers', icon: Box },
      ],
    },
    {
      id: 'buyer-finance',
      label: 'Dokumenti un Finanses',
      icon: FolderOpen,
      items: [
        { label: 'Rēķini', href: '/dashboard/invoices', icon: Receipt },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
        { label: 'Sertifikāti', href: '/dashboard/certificates', icon: Award },
        { label: 'Ziņojumi', href: '/dashboard/chat', icon: MessageSquare },
      ],
    },
  ],
  SUPPLIER: [
    {
      id: 'supplier-workspace',
      label: 'Darbvieta',
      icon: LayoutGrid,
      items: [
        { label: 'Informācijas Panelis', href: '/dashboard/supplier', icon: LayoutDashboard },
        { label: 'Ienākošie Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Pieprasījumu Tirgus', href: '/dashboard/quote-requests/open', icon: Search },
      ],
    },
    {
      id: 'supplier-catalog',
      label: 'Katalogs un Kvalitāte',
      icon: Package,
      items: [
        { label: 'Mani Materiāli', href: '/dashboard/materials', icon: Package },
        { label: 'Sertifikāti', href: '/dashboard/certificates', icon: Award },
      ],
    },
    {
      id: 'supplier-business',
      label: 'Bizness un Saziņa',
      icon: Banknote,
      items: [
        { label: 'Ieņēmumi', href: '/dashboard/supplier/earnings', icon: Banknote },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Atsauksmes', href: '/dashboard/reviews', icon: Star },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
        { label: 'Ziņojumi', href: '/dashboard/chat', icon: MessageSquare },
      ],
    },
  ],
  CARRIER: [
    {
      id: 'carrier-jobs',
      label: 'Darbi',
      icon: Briefcase,
      items: [
        { label: 'Informācijas Panelis', href: '/dashboard/transporter', icon: LayoutDashboard },
        { label: 'Darbu Tirgus', href: '/dashboard/jobs', icon: Briefcase },
        { label: 'Mani Darbi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Darba Grafiks', href: '/dashboard/schedule', icon: CalendarClock },
        { label: 'Utilizācijas Centri', href: '/dashboard/recycling-centers', icon: Recycle },
      ],
    },
    {
      id: 'carrier-fleet',
      label: 'Flote',
      icon: Car,
      items: [{ label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car }],
    },
    {
      id: 'carrier-business',
      label: 'Finanses un Dokumenti',
      icon: Banknote,
      items: [
        { label: 'Ienākumi', href: '/dashboard/transporter/earnings', icon: Banknote },
        { label: 'Analītika', href: '/dashboard/analytics', icon: BarChart3 },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
        { label: 'Ziņojumi', href: '/dashboard/chat', icon: MessageSquare },
      ],
    },
  ],
};

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
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, token, logout } = useAuth();
  const { activeMode } = useMode();
  const router = useRouter();
  const pathname = usePathname();
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>({
    notifications: 0,
    openRfqs: 0,
    activeJobs: 0,
  });

  const isRouteActive = React.useCallback(
    (href: string) => {
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const navSections = React.useMemo(() => {
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
        // Inject Dispatcher Panel for company owners/managers only
        sections = sections.map((section) => {
          if (section.id !== 'carrier-jobs') return section;
          return {
            ...section,
            items: [
              section.items[0],
              { label: 'Dispečera Panelis', href: '/dashboard/fleet', icon: LayoutGrid },
              ...section.items.slice(1),
            ],
          };
        });
      }

      if (isCompanyDriver) {
        // Company drivers are field workers — hide dispatcher-only management screens
        sections = sections.map((section) => {
          if (section.id === 'carrier-jobs') {
            return {
              ...section,
              items: section.items.filter((item) => item.href !== '/dashboard/transporter'),
            };
          }
          return section;
        });
      }
    }

    return sections;
  }, [activeMode, user]);

  const [recentHrefs, setRecentHrefs] = React.useState<string[]>([]);

  const navLookup = React.useMemo(() => {
    const map = new Map<string, NavItem>();
    for (const section of navSections) {
      for (const item of section.items) {
        map.set(item.href, item);
      }
    }

    map.set('/dashboard/settings', {
      label: 'Iestatījumi',
      href: '/dashboard/settings',
      icon: Settings,
    });

    if (user?.isCompany) {
      map.set('/dashboard/company', {
        label: 'Uzņēmuma profils',
        href: '/dashboard/company',
        icon: Building2,
      });
      if (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER') {
        map.set('/dashboard/company/team', {
          label: 'Komanda',
          href: '/dashboard/company/team',
          icon: Users,
        });
      }
    }

    if (user?.userType === 'ADMIN') {
      map.set('/dashboard/admin', {
        label: 'Pārskats',
        href: '/dashboard/admin',
        icon: LayoutDashboard,
      });
      map.set('/dashboard/admin/users', {
        label: 'Lietotāji',
        href: '/dashboard/admin/users',
        icon: Users,
      });
      map.set('/dashboard/admin/applications', {
        label: 'Pieteikumi',
        href: '/dashboard/admin/applications',
        icon: ShieldCheck,
      });
    }

    return map;
  }, [navSections, user]);

  const recentStorageKey = React.useMemo(() => {
    const scope = user?.id ?? 'guest';
    return `b3hub_recent_nav_${scope}_${activeMode}`;
  }, [activeMode, user?.id]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(recentStorageKey);
      if (!raw) {
        setRecentHrefs([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setRecentHrefs(
        Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [],
      );
    } catch {
      setRecentHrefs([]);
    }
  }, [recentStorageKey]);

  React.useEffect(() => {
    const normalized = pathname.startsWith('/dashboard') ? pathname : null;
    if (!normalized) return;

    const known = navLookup.get(normalized);
    if (!known) return;

    const next = [normalized, ...recentHrefs.filter((href) => href !== normalized)].slice(
      0,
      MAX_RECENT_ITEMS,
    );

    if (next.join('|') === recentHrefs.join('|')) return;

    setRecentHrefs(next);
    try {
      window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
    } catch {
      // Ignore localStorage write errors.
    }
  }, [pathname, recentHrefs, recentStorageKey, navLookup]);

  const recentItems = React.useMemo(
    () =>
      recentHrefs
        .map((href) => navLookup.get(href))
        .filter((item): item is NavItem => Boolean(item)),
    [recentHrefs, navLookup],
  );

  const removeRecentItem = React.useCallback(
    (href: string) => {
      const next = recentHrefs.filter((h) => h !== href);
      setRecentHrefs(next);
      try {
        window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
      } catch {
        // Ignore localStorage write errors.
      }
    },
    [recentHrefs, recentStorageKey],
  );

  React.useEffect(() => {
    if (!token) {
      setBadgeCounts({ notifications: 0, openRfqs: 0, activeJobs: 0 });
      return;
    }

    let cancelled = false;

    const loadBadgeCounts = async () => {
      const [notificationsResult, rfqResult, activeJobsResult] = await Promise.allSettled([
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
      });
    };

    loadBadgeCounts();
    const intervalId = window.setInterval(loadBadgeCounts, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeMode, token, user?.companyRole, user?.permManageOrders, user?.userType]);

  const itemBadgeCountByHref = React.useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {
      '/dashboard/notifications': badgeCounts.notifications,
      '/dashboard/quote-requests/open': badgeCounts.openRfqs,
    };

    if (activeMode === 'CARRIER') {
      map['/dashboard/orders'] = badgeCounts.activeJobs;
    }

    return map;
  }, [activeMode, badgeCounts.activeJobs, badgeCounts.notifications, badgeCounts.openRfqs]);

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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">B3Hub</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {MODE_LABEL[activeMode]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 pt-4 pb-2 space-y-4">
          {/* Primary Actions based on Mode */}
          {activeMode === 'BUYER' && (
            <SidebarMenuButton
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground w-full justify-center shadow font-semibold h-10"
            >
              <Link href="/dashboard/order">
                <PackagePlus className="mr-2 size-4" />
                Jauns Pasūtījums
              </Link>
            </SidebarMenuButton>
          )}

          {activeMode === 'SUPPLIER' && (
            <SidebarMenuButton
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground w-full justify-center shadow font-semibold h-10"
            >
              <Link href="/dashboard/materials/new">
                <PackagePlus className="mr-2 size-4" />
                Pievienot Materiālu
              </Link>
            </SidebarMenuButton>
          )}

          {/* Global Actions (Quick Access) */}
          <div className="flex items-center gap-1">
            <SidebarMenuButton
              asChild
              tooltip="Paziņojumi"
              className="flex-1 justify-center relative bg-muted/30 hover:bg-muted/60 h-10"
              isActive={pathname === '/dashboard/notifications'}
            >
              <Link href="/dashboard/notifications">
                <Bell className="size-4 text-muted-foreground" />
                <span className="sr-only">Paziņojumi</span>
                {badgeCounts.notifications > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute top-1 right-2 size-4 p-0 flex items-center justify-center text-[9px]"
                  >
                    {badgeCounts.notifications}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>

            <SidebarMenuButton
              asChild
              tooltip="Čats"
              className="flex-1 justify-center bg-muted/30 hover:bg-muted/60 h-10"
              isActive={pathname === '/dashboard/chat'}
            >
              <Link href="/dashboard/chat">
                <MessageSquare className="size-4 text-muted-foreground" />
                <span className="sr-only">Čats</span>
              </Link>
            </SidebarMenuButton>
          </div>
        </div>

        {recentItems.length > 0 && (
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-muted-foreground/60 tracking-wider">
              Nesen Atvērtais
            </SidebarGroupLabel>
            <SidebarMenu>
              {recentItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={isRouteActive(item.href)}
                    className="font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Link href={item.href}>
                      <Clock3 className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    title="Noņemt"
                    onClick={(e) => {
                      e.preventDefault();
                      removeRecentItem(item.href);
                    }}
                    className="text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    <X className="size-3" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {navSections.map((section) => (
          <SidebarGroup key={section.id} className="pt-2">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-muted-foreground/60 tracking-wider pb-1">
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
                      className="font-medium text-muted-foreground hover:text-foreground"
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

        {/* Admin section */}
        {user?.userType === 'ADMIN' && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-destructive/80 tracking-wider">
              Administrācija
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Pārskats"
                  isActive={pathname === '/dashboard/admin'}
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
                  isActive={pathname === '/dashboard/admin/users'}
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
                  tooltip="Pieteikumi"
                  isActive={pathname === '/dashboard/admin/applications'}
                >
                  <Link href="/dashboard/admin/applications">
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>Pieteikumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Unified Settings & Company */}
        <SidebarGroup className="mt-auto pt-4 pb-2">
          <SidebarGroupLabel className="text-[10px] uppercase font-semibold text-muted-foreground/60 tracking-wider pb-1">
            Konta Pārvaldība
          </SidebarGroupLabel>
          <SidebarMenu>
            {user?.isCompany && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Uzņēmuma profils"
                    isActive={pathname === '/dashboard/company'}
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
                      isActive={pathname === '/dashboard/company/team'}
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
                isActive={pathname === '/dashboard/settings'}
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
                <AvatarFallback className="rounded-lg bg-red-100 text-red-700 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Iziet"
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
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
