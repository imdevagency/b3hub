'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  BarChart3,
  Banknote,
  CheckCircle,
  FolderOpen,
  Headset,
  Inbox,
  MapPin,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

type Stat = { label: string; value: string; icon: LucideIcon; hint?: string };
type Action = {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
};

// ── Data ───────────────────────────────────────────────────────

const ROLE_STATS: Record<string, Stat[]> = {
  BUYER: [
    { label: 'Active Orders', value: '—', icon: ShoppingCart, hint: 'Orders in progress' },
    { label: 'Pending Deliveries', value: '—', icon: Truck, hint: 'Awaiting delivery' },
    { label: 'My Documents', value: '—', icon: FolderOpen, hint: 'Invoices & slips' },
    { label: 'Materials Ordered', value: '—', icon: Package, hint: 'Total line items' },
  ],
  SUPPLIER: [
    { label: 'Active Listings', value: '—', icon: Package, hint: 'Published products' },
    { label: 'Pending Orders', value: '—', icon: ShoppingCart, hint: 'Awaiting fulfilment' },
    { label: 'Monthly Revenue', value: '—', icon: TrendingUp, hint: 'This month' },
    { label: 'My Documents', value: '—', icon: FolderOpen, hint: 'Invoices & contracts' },
  ],
  CARRIER: [
    { label: 'Active Jobs', value: '—', icon: MapPin, hint: 'Assigned transport' },
    { label: 'Completed Today', value: '—', icon: CheckCircle, hint: 'Delivered today' },
    { label: 'Pending Earnings', value: '—', icon: Banknote, hint: 'Awaiting payment' },
    { label: 'My Documents', value: '—', icon: FolderOpen, hint: 'CMR & proofs' },
  ],
  PRIVATE: [
    { label: 'My Orders', value: '—', icon: ShoppingCart, hint: 'Skip hire orders' },
    { label: 'Pending Deliveries', value: '—', icon: Truck, hint: 'Awaiting delivery' },
    { label: 'My Documents', value: '—', icon: FolderOpen, hint: 'Invoices & paperwork' },
    { label: 'Support Tickets', value: '—', icon: Headset, hint: 'Open tickets' },
  ],
};

const ROLE_ACTIONS: Record<string, Action[]> = {
  BUYER: [
    {
      label: 'Browse Materials',
      description: 'Order sand, gravel, concrete & more',
      icon: Package,
      href: '/materials',
      primary: true,
    },
    {
      label: 'Hire a Skip',
      description: 'Book a waste skip for your site',
      icon: Trash2,
      href: '/order',
      primary: true,
    },
    {
      label: 'My Orders',
      description: 'Track all active orders',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Track Delivery',
      description: 'See live driver location',
      icon: Truck,
      href: '/tracking',
    },
    {
      label: 'My Documents',
      description: 'Invoices, weighing slips & more',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  SUPPLIER: [
    {
      label: 'My Products',
      description: 'Manage your material listings',
      icon: Package,
      href: '/products',
      primary: true,
    },
    {
      label: 'Add Product',
      description: 'List a new material for sale',
      icon: Plus,
      href: '/products/new',
      primary: true,
    },
    {
      label: 'Incoming Orders',
      description: 'View and fulfil new orders',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Analytics',
      description: 'Sales and performance stats',
      icon: BarChart3,
      href: '/analytics',
    },
    {
      label: 'My Documents',
      description: 'Invoices, contracts & certificates',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  CARRIER: [
    {
      label: 'Active Jobs',
      description: 'View your assigned transport jobs',
      icon: MapPin,
      href: '/jobs',
      primary: true,
    },
    { label: 'Route', description: 'Open navigation for current job', icon: Truck, href: '/route' },
    {
      label: 'Complete Delivery',
      description: 'Confirm and upload proof',
      icon: CheckCircle,
      href: '/jobs/complete',
    },
    { label: 'Earnings', description: 'Track your payments', icon: Banknote, href: '/earnings' },
    {
      label: 'My Documents',
      description: 'CMR notes & delivery proofs',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  PRIVATE: [
    {
      label: 'Hire a Skip',
      description: 'Book a waste skip for home',
      icon: Trash2,
      href: '/order',
      primary: true,
    },
    {
      label: 'My Orders',
      description: 'Track your skip hire orders',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Track Delivery',
      description: 'See when your skip arrives',
      icon: Truck,
      href: '/tracking',
    },
    { label: 'Support', description: 'Get help with your order', icon: Headset, href: '/support' },
    {
      label: 'My Documents',
      description: 'Invoices & order paperwork',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Contractor',
  SUPPLIER: 'Supplier',
  CARRIER: 'Carrier',
  PRIVATE: 'Private Person',
  ADMIN: 'Admin',
};

const ROLE_TAGLINE: Record<string, string> = {
  BUYER: 'Order materials and manage your construction deliveries.',
  SUPPLIER: 'Manage your listings and fulfil incoming orders.',
  CARRIER: 'View your transport jobs and track your earnings.',
  PRIVATE: 'Order a skip and manage your home waste removal.',
  ADMIN: 'Manage the platform and oversee all operations.',
};

// ── Component ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  const stats = ROLE_STATS[user.userType] ?? ROLE_STATS.PRIVATE;
  const actions = ROLE_ACTIONS[user.userType] ?? ROLE_ACTIONS.PRIVATE;
  const label = ROLE_LABEL[user.userType] ?? user.userType;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Welcome ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {user.firstName}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_TAGLINE[user.userType] ?? 'Manage your account.'}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          {label}
        </span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-none border-border/50 bg-background">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-4 px-4">
              <CardDescription className="text-xs font-medium leading-tight">
                {stat.label}
              </CardDescription>
              <stat.icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
              {stat.hint && <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quick actions
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.label} href={action.href} className="group block">
              <Card
                className={`h-full shadow-none transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-sm ${
                  action.primary
                    ? 'border-red-200 bg-red-50/70 hover:border-red-400 hover:bg-red-50'
                    : 'border-border/50 bg-background hover:border-border'
                }`}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        action.primary
                          ? 'bg-red-600 text-white group-hover:bg-red-700'
                          : 'bg-muted text-muted-foreground group-hover:bg-muted/70'
                      }`}
                    >
                      <action.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {action.label}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Recent activity
        </p>
        <Card className="shadow-none border-border/50 bg-background">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Your orders, deliveries and notifications will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
