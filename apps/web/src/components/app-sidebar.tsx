'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  Car,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { useMode, type Mode } from '@/lib/mode-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
};

const ROLE_NAV: Record<Mode, NavItem[]> = {
  BUYER: [
    { label: 'Informācijas Panelis', href: '/dashboard/buyer', icon: LayoutDashboard },
    { label: 'Materiālu Katalogs', href: '/dashboard/catalog', icon: Package },
    { label: 'Grozs', href: '/dashboard/checkout', icon: ShoppingCart },
    { label: 'Mani Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Rēķini', href: '/dashboard/invoices', icon: Receipt },
    { label: 'Pasūtīt', href: '/dashboard/order', icon: LayoutGrid },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  SUPPLIER: [
    { label: 'Informācijas Panelis', href: '/dashboard/supplier', icon: LayoutDashboard },
    { label: 'Mani Materiāli', href: '/dashboard/materials', icon: Package },
    { label: 'Ienākošie Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  CARRIER: [
    { label: 'Informācijas Panelis', href: '/dashboard/transporter', icon: LayoutDashboard },
    { label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car },
    { label: 'Job Board', href: '/dashboard/jobs', icon: MapPin },
    { label: 'Mani Darbi', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Aktīvais Darbs', href: '/dashboard/active', icon: Truck },
    { label: 'Darba Grafiks', href: '/dashboard/schedule', icon: CalendarClock },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
};

const MODE_LABEL: Record<Mode, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth();
  const { activeMode, setActiveMode, availableModes } = useMode();
  const router = useRouter();
  const pathname = usePathname();

  const handleModeSwitch = (mode: Mode) => {
    setActiveMode(mode);
    router.push(ROLE_HOME[mode]);
  };

  const navItems = React.useMemo(() => {
    const base = ROLE_NAV[activeMode];
    let items: NavItem[] = [...base];
    if (activeMode === 'CARRIER' && user?.isCompany) {
      items = [
        base[0],
        { label: 'Dispečera Panelis', href: '/dashboard/fleet', icon: LayoutGrid } as NavItem,
        ...base.slice(1),
      ];
    }
    return items;
  }, [activeMode, user]);

  const isMultiRole = availableModes.length > 1;
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
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-red-600 text-white shrink-0">
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

        {/* Role switcher — only for multi-role users, hidden when collapsed */}
        {isMultiRole && (
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <Select value={activeMode} onValueChange={(v) => handleModeSwitch(v as Mode)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModes.map((mode) => (
                  <SelectItem key={mode} value={mode} className="text-xs">
                    {MODE_LABEL[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Izvēlne</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.href}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
              onClick={() => { logout(); router.push('/'); }}
              className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
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
