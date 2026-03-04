'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Banknote,
  Building2,
  Car,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
  ShieldCheck,
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
type Mode = 'BUYER' | 'SUPPLIER' | 'CARRIER';

const ROLE_NAV: Record<Mode, NavItem[]> = {
  BUYER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Materiālu Katalogs', href: '/dashboard/catalog', icon: Package },
    { label: 'Mani Pasūtījumi', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Pasūtīt Konteineru', href: '/dashboard/order', icon: Trash2 },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  SUPPLIER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mani Materiāli', href: '/dashboard/catalog', icon: Package },
    { label: 'Ienākošie Pasūtījumi', href: '/dashboard/orders', icon: ShoppingCart },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
  CARRIER: [
    { label: 'Informācijas Panelis', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mans Autoparks', href: '/dashboard/garage', icon: Car },
    { label: 'Job Board', href: '/dashboard/jobs', icon: MapPin },
    { label: 'Mani Darbi', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Aktīvais Darbs', href: '/dashboard/active', icon: Truck },
    { label: 'Ieņēmumi', href: '/dashboard/earnings', icon: Banknote },
    { label: 'Mani Dokumenti', href: '/dashboard/documents', icon: FolderOpen },
  ],
};

const MODE_LABEL: Record<Mode, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
};

const MODE_EMOJI: Record<Mode, string> = {
  BUYER: '🛒',
  SUPPLIER: '📦',
  CARRIER: '🚛',
};

const LS_MODE_KEY = 'b3hub_active_mode';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Determine which modes this user has access to
  const availableModes = React.useMemo<Mode[]>(() => {
    if (!user) return ['BUYER'];
    const modes: Mode[] = [];
    const isAdmin = user.userType === 'ADMIN';
    // userType defaults to BUYER in the DB for all users, so we must check
    // transport/sell flags explicitly to avoid showing BUYER to transport-only users
    const isTransport = user.canTransport || user.userType === 'CARRIER';

    // BUYER: non-transport users + admins (who see everything)
    if (isAdmin || (!isTransport && user.userType === 'BUYER')) modes.push('BUYER');
    if (isAdmin || user.userType === 'SUPPLIER' || user.canSell) modes.push('SUPPLIER');
    if (isAdmin || isTransport) modes.push('CARRIER');
    // Ensure at least one mode
    if (modes.length === 0) modes.push('BUYER');
    return modes;
  }, [user]);

  // Active mode — persisted to localStorage
  const defaultMode: Mode = availableModes[0];
  const [activeMode, setActiveMode] = React.useState<Mode>(defaultMode);

  // Hydrate from localStorage once mounted
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_MODE_KEY) as Mode | null;
      if (stored && availableModes.includes(stored)) setActiveMode(stored);
    } catch {
      /* ignore */
    }
  }, [availableModes]);

  const handleModeSwitch = (mode: Mode) => {
    setActiveMode(mode);
    try {
      localStorage.setItem(LS_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    router.push('/dashboard');
  };

  const navItems = React.useMemo(() => {
    const base = ROLE_NAV[activeMode];
    if (activeMode === 'CARRIER' && user?.isCompany) {
      return [
        base[0], // Informācijas Panelis
        { label: 'Dispečera Panelis', href: '/dashboard/fleet', icon: LayoutGrid } as NavItem,
        ...base.slice(1),
      ];
    }
    return base;
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
                    {MODE_EMOJI[activeMode]} {MODE_LABEL[activeMode]}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Role switcher — only shown for multi-role users, hidden when sidebar collapsed */}
        {isMultiRole && (
          <div className="px-2 pb-1 flex gap-1 group-data-[collapsible=icon]:hidden">
            {availableModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeSwitch(mode)}
                title={MODE_LABEL[mode]}
                className={`flex-1 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors ${
                  activeMode === mode
                    ? 'bg-red-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {MODE_EMOJI[mode]} {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        )}
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

        {/* Admin section — only shown to ADMIN users */}
        {user?.userType === 'ADMIN' && (
          <SidebarGroup>
            <SidebarGroupLabel>Administrācija</SidebarGroupLabel>
            <SidebarMenu>
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

        {/* Settings pinned to bottom */}
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
