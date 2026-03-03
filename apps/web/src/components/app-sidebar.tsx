'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Banknote,
  Building2,
  Car,
  CheckCircle,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

const ROLE_NAV: Record<string, NavItem[]> = {
  BUYER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Pārlūkot Materiālus', href: '/materials', icon: Package },
    { label: 'Pasūtīt Konteineru', href: '/dashboard/order', icon: Trash2 },
    { label: 'Mani Pasūtījumi', href: '/orders', icon: ShoppingCart },
    { label: 'Izsekot Piegādei', href: '/tracking', icon: Truck },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  SUPPLIER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mani Produkti', href: '/products', icon: Package },
    { label: 'Pievienot Produktu', href: '/products/new', icon: Plus },
    { label: 'Ienākošie Pasūtījumi', href: '/orders', icon: ShoppingCart },
    { label: 'Analītika', href: '/analytics', icon: BarChart3 },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  CARRIER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car },
    { label: 'Aktīvie Darbi', href: '/jobs', icon: MapPin },
    { label: 'Maršruts', href: '/route', icon: Truck },
    { label: 'Pabeigt Piegādi', href: '/jobs/complete', icon: CheckCircle },
    { label: 'Ieņēmumi', href: '/earnings', icon: Banknote },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
};

const USER_TYPE_LABEL: Record<string, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
  ADMIN: 'Administrators',
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const baseNav = (user?.userType ? ROLE_NAV[user.userType] : null) ?? ROLE_NAV.BUYER;

  // Users with canTransport (e.g. BUYER who also runs their own fleet) get the garage link
  const garageItem: NavItem = { label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car };
  const navItems =
    user?.canTransport && !baseNav.find((i) => i.href === '/dashboard/garage')
      ? [
          ...baseNav.slice(0, -1), // everything except Mani Dokumenti
          garageItem,
          baseNav[baseNav.length - 1], // Mani Dokumenti last
        ]
      : baseNav;

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
                    {USER_TYPE_LABEL[user?.userType ?? ''] ?? 'Platform'}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Role-based nav */}
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

        {/* Settings pinned to bottom */}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Iestatījumi" isActive={pathname === '/settings'}>
                <Link href="/settings">
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
