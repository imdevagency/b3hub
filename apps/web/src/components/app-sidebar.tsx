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
  Bell,
  Box,
  Briefcase,
  Building2,
  CalendarClock,
  Car,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileQuestion,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  PackagePlus,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Star,
  Users,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
};

const ROLE_NAV: Record<Mode, NavSection[]> = {
  BUYER: [
    {
      id: 'buyer-workspace',
      label: 'Darbvieta',
      icon: LayoutGrid,
      items: [
        { label: 'Informācijas Panelis', href: '/dashboard/buyer', icon: LayoutDashboard },
        { label: 'Materiālu Katalogs', href: '/dashboard/catalog', icon: Package },
        { label: 'Pasūtīt', href: '/dashboard/order', icon: PackagePlus },
        { label: 'Grozs', href: '/dashboard/checkout', icon: ShoppingCart },
      ],
    },
    {
      id: 'buyer-orders',
      label: 'Pasūtījumi',
      icon: ClipboardList,
      items: [
        { label: 'Mani Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
        { label: 'Projekti', href: '/dashboard/buyer/projects', icon: FolderKanban },
        { label: 'Ietvarlīgumi', href: '/dashboard/framework-contracts', icon: ScrollText },
        { label: 'Konteineri', href: '/dashboard/containers', icon: Box },
        { label: 'Cenu Pieprasījumi', href: '/dashboard/quote-requests', icon: FileQuestion },
      ],
    },
    {
      id: 'buyer-finance',
      label: 'Finanses un Dokumenti',
      icon: FolderOpen,
      items: [
        { label: 'Rēķini', href: '/dashboard/invoices', icon: Receipt },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
        { label: 'Sertifikāti', href: '/dashboard/certificates', icon: Award },
      ],
    },
    {
      id: 'buyer-comms',
      label: 'Saziņa',
      icon: Bell,
      items: [
        { label: 'Pazņojumi', href: '/dashboard/notifications', icon: Bell },
        { label: 'Čats', href: '/dashboard/chat', icon: MessageSquare },
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
      label: 'Bizness',
      icon: Banknote,
      items: [
        { label: 'Ieņēmumi', href: '/dashboard/supplier/earnings', icon: Banknote },
        { label: 'Atsauksmes', href: '/dashboard/reviews', icon: Star },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
        { label: 'Pazņojumi', href: '/dashboard/notifications', icon: Bell },
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
      ],
    },
    {
      id: 'carrier-fleet',
      label: 'Flote',
      icon: Car,
      items: [
        { label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car },
        { label: 'Utilizācijas Centri', href: '/dashboard/recycling-centers', icon: MapPin },
      ],
    },
    {
      id: 'carrier-business',
      label: 'Finanses un Saziņa',
      icon: Banknote,
      items: [
        { label: 'Ienākumi', href: '/dashboard/transporter/earnings', icon: Banknote },
        { label: 'Pazņojumi', href: '/dashboard/notifications', icon: Bell },
        { label: 'Čats', href: '/dashboard/chat', icon: MessageSquare },
        { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
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

    if (activeMode === 'CARRIER' && user?.isCompany) {
      sections = sections.map((section) => {
        if (section.id !== 'carrier-jobs') {
          return section;
        }

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

    return sections;
  }, [activeMode, user]);

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [recentHrefs, setRecentHrefs] = React.useState<string[]>([]);

  React.useEffect(() => {
    setOpenSections((previous) => {
      const next = { ...previous };
      for (const section of navSections) {
        const hasActiveItem = section.items.some((item) => isRouteActive(item.href));
        if (hasActiveItem) {
          next[section.id] = true;
          continue;
        }
        if (next[section.id] === undefined) {
          next[section.id] = false;
        }
      }
      return next;
    });
  }, [navSections, isRouteActive]);

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
                !!user?.permManageOrders;

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

  const sectionBadgeCountById = React.useMemo<Record<string, number>>(() => {
    return {
      'buyer-comms': badgeCounts.notifications,
      'supplier-workspace': badgeCounts.openRfqs,
      'carrier-jobs': badgeCounts.activeJobs,
    };
  }, [badgeCounts.activeJobs, badgeCounts.notifications, badgeCounts.openRfqs]);

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
        {recentItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Nesen Atvērtais</SidebarGroupLabel>
            <SidebarMenu>
              {recentItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={isRouteActive(item.href)}
                  >
                    <Link href={item.href}>
                      <Clock3 />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Izvēlne</SidebarGroupLabel>
          <SidebarMenu>
            {navSections.map((section) => {
              const hasActiveItem = section.items.some((item) => isRouteActive(item.href));
              return (
                <Collapsible
                  key={section.id}
                  open={Boolean(openSections[section.id])}
                  onOpenChange={(isOpen) =>
                    setOpenSections((previous) => ({
                      ...previous,
                      [section.id]: isOpen,
                    }))
                  }
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={section.label}
                        isActive={hasActiveItem}
                        aria-label={section.label}
                      >
                        <section.icon />
                        <span>{section.label}</span>
                        {renderBadge(sectionBadgeCountById[section.id] ?? 0)}
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {section.items.map((item) => (
                          <SidebarMenuSubItem key={item.label}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isRouteActive(item.href)}
                              aria-label={item.label}
                            >
                              <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                                {renderBadge(itemBadgeCountByHref[item.href] ?? 0)}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Company management */}
        {user?.isCompany && (
          <SidebarGroup>
            <SidebarGroupLabel>Uzņēmums</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Uzņēmuma profils"
                  isActive={pathname === '/dashboard/company'}
                >
                  <Link href="/dashboard/company">
                    <Building2 />
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
                      <Users />
                      <span>Komanda</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Admin section */}
        {user?.userType === 'ADMIN' && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrācija</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Pārskats"
                  isActive={pathname === '/dashboard/admin'}
                >
                  <Link href="/dashboard/admin">
                    <LayoutDashboard />
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
                    <Users />
                    <span>Lietotāji</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Piegādātāju pieteikumi"
                  isActive={pathname === '/dashboard/admin/applications'}
                >
                  <Link href="/dashboard/admin/applications">
                    <ShieldCheck />
                    <span>Pieteikumi</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Settings */}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Iestatījumi"
                isActive={pathname === '/dashboard/settings'}
              >
                <Link href="/dashboard/settings">
                  <Settings />
                  <span>Iestatījumi</span>
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
