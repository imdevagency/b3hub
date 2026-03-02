'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Banknote,
  Building2,
  CheckCircle,
  FolderOpen,
  Headset,
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
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Browse Materials', href: '/materials', icon: Package },
    { label: 'Hire a Skip', href: '/order', icon: Trash2 },
    { label: 'My Orders', href: '/orders', icon: ShoppingCart },
    { label: 'Track Delivery', href: '/tracking', icon: Truck },
    { label: 'My Documents', href: '/dashboard/documents', icon: FolderOpen },
  ],
  SUPPLIER: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Products', href: '/products', icon: Package },
    { label: 'Add Product', href: '/products/new', icon: Plus },
    { label: 'Incoming Orders', href: '/orders', icon: ShoppingCart },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'My Documents', href: '/dashboard/documents', icon: FolderOpen },
  ],
  CARRIER: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Active Jobs', href: '/jobs', icon: MapPin },
    { label: 'Route', href: '/route', icon: Truck },
    { label: 'Complete Delivery', href: '/jobs/complete', icon: CheckCircle },
    { label: 'Earnings', href: '/earnings', icon: Banknote },
    { label: 'My Documents', href: '/dashboard/documents', icon: FolderOpen },
  ],
  PRIVATE: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Hire a Skip', href: '/order', icon: Trash2 },
    { label: 'My Orders', href: '/orders', icon: ShoppingCart },
    { label: 'Track Delivery', href: '/tracking', icon: Truck },
    { label: 'Support', href: '/support', icon: Headset },
    { label: 'My Documents', href: '/dashboard/documents', icon: FolderOpen },
  ],
};

const USER_TYPE_LABEL: Record<string, string> = {
  BUYER: 'Contractor',
  SUPPLIER: 'Supplier',
  CARRIER: 'Carrier',
  PRIVATE: 'Private',
  ADMIN: 'Admin',
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navItems = (user?.userType ? ROLE_NAV[user.userType] : null) ?? ROLE_NAV.PRIVATE;

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
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
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
              <SidebarMenuButton asChild tooltip="Settings" isActive={pathname === '/settings'}>
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
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
              tooltip="Sign out"
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
