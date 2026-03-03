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
    { label: 'Aktīvie Pasūtījumi', value: '—', icon: ShoppingCart, hint: 'Pasūtījumi procesā' },
    { label: 'Gaida Piegāde', value: '—', icon: Truck, hint: 'Gaida piegādi' },
    { label: 'Mani Dokumenti', value: '—', icon: FolderOpen, hint: 'Rēķini un lapas' },
    { label: 'Pasūtītie Materiāli', value: '—', icon: Package, hint: 'Kopā pozīcijas' },
  ],
  SUPPLIER: [
    { label: 'Aktīvie Sludinājumi', value: '—', icon: Package, hint: 'Publicēti produkti' },
    { label: 'Gaida Pasūtījumi', value: '—', icon: ShoppingCart, hint: 'Gaida izpildi' },
    { label: 'Mēneša Ieņēmumi', value: '—', icon: TrendingUp, hint: 'Šajā mēnesī' },
    { label: 'Mani Dokumenti', value: '—', icon: FolderOpen, hint: 'Rēķini un līgumi' },
  ],
  CARRIER: [
    { label: 'Aktīvie Darbi', value: '—', icon: MapPin, hint: 'Piešķirtais transports' },
    { label: 'Pabeigti Šodien', value: '—', icon: CheckCircle, hint: 'Piegādāts šodien' },
    { label: 'Gaida Samaksa', value: '—', icon: Banknote, hint: 'Gaida maksājumu' },
    { label: 'Mani Dokumenti', value: '—', icon: FolderOpen, hint: 'CMR un apstiprinājumi' },
  ],
  PRIVATE: [
    {
      label: 'Mani Pasūtījumi',
      value: '—',
      icon: ShoppingCart,
      hint: 'Konteinera nomas pasūtījumi',
    },
    { label: 'Gaida Piegāde', value: '—', icon: Truck, hint: 'Gaida piegādi' },
    { label: 'Mani Dokumenti', value: '—', icon: FolderOpen, hint: 'Rēķini un dokumenti' },
    { label: 'Atbalsta Pieprasījumi', value: '—', icon: Headset, hint: 'Atvērtie pieprasījumi' },
  ],
};

const ROLE_ACTIONS: Record<string, Action[]> = {
  BUYER: [
    {
      label: 'Pārlūkot Materiālus',
      description: 'Pasūtīt smiltis, granti, betonu un vairāk',
      icon: Package,
      href: '/materials',
      primary: true,
    },
    {
      label: 'Pasūtīt Konteineru',
      description: 'Rezervēt atkritumu konteineru savai darba vietai',
      icon: Trash2,
      href: '/order',
      primary: true,
    },
    {
      label: 'Mani Pasūtījumi',
      description: 'Izsekot visiem aktīvajiem pasūtījumiem',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Izsekot Piegādei',
      description: 'Skatīt transportlīdzeļa atrasanos vietu reāllaikā',
      icon: Truck,
      href: '/tracking',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Rēķini, svēršanas lapas un citi',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  SUPPLIER: [
    {
      label: 'Mani Produkti',
      description: 'Pārvaldīt savus materiālu sludinājumus',
      icon: Package,
      href: '/products',
      primary: true,
    },
    {
      label: 'Pievienot Produktu',
      description: 'Pievienot jaunu materiālu pārdošanai',
      icon: Plus,
      href: '/products/new',
      primary: true,
    },
    {
      label: 'Ienākošie Pasūtījumi',
      description: 'Skatīt un izpildīt jaunus pasūtījumus',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Analītika',
      description: 'Pārdošanas un veiktspējas statistika',
      icon: BarChart3,
      href: '/analytics',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Rēķini, līgumi un sertifikāti',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  CARRIER: [
    {
      label: 'Aktīvie Darbi',
      description: 'Skatīt piešķirtos transporta darbus',
      icon: MapPin,
      href: '/jobs',
      primary: true,
    },
    {
      label: 'Maršruts',
      description: 'Atvērt navigāciju pašreizējam darbam',
      icon: Truck,
      href: '/route',
    },
    {
      label: 'Pabeigt Piegādi',
      description: 'Apstiprānāt un augšupielādēt apstiprinājumu',
      icon: CheckCircle,
      href: '/jobs/complete',
    },
    {
      label: 'Ieņēmumi',
      description: 'Izsekot saviem maksājumiem',
      icon: Banknote,
      href: '/earnings',
    },
    {
      label: 'Mani Dokumenti',
      description: 'CMR piezīmes un piegādes apstiprinājumi',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
  PRIVATE: [
    {
      label: 'Pasūtīt Konteineru',
      description: 'Rezervēt atkritumu konteineru mājām',
      icon: Trash2,
      href: '/order',
      primary: true,
    },
    {
      label: 'Mani Pasūtījumi',
      description: 'Izsekot konteinera nomas pasūtījumiem',
      icon: ShoppingCart,
      href: '/orders',
    },
    {
      label: 'Izsekot Piegādei',
      description: 'Skatīt, kad konteineru piegādās',
      icon: Truck,
      href: '/tracking',
    },
    {
      label: 'Atbalsts',
      description: 'Saņemt palīdzību ar pasūtījumu',
      icon: Headset,
      href: '/support',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Rēķini un pasūtījuma dokumenti',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Darbuzņēmējs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
  PRIVATE: 'Privātpersona',
  ADMIN: 'Administrators',
};

const ROLE_TAGLINE: Record<string, string> = {
  BUYER: 'Pasūtīt materiālus un pārvaldīt celtniecības piegādes.',
  SUPPLIER: 'Pārvaldīt savus sludinājumus un izpildīt ienākošos pasūtījumus.',
  CARRIER: 'Skatīt savus transporta darbus un izsekot ieņēkumiem.',
  PRIVATE: 'Pasūtīt konteineru un pārvaldīt mājas atkritumu izvešanu.',
  ADMIN: 'Pārvaldīt platformu un uzraudzīt visas darbības.',
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
            Laipni atgriezties, {user.firstName}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_TAGLINE[user.userType] ?? 'Pārvaldiet savu kontu.'}
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
          Ātrās darbības
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
          Pēdējā aktivitāte
        </p>
        <Card className="shadow-none border-border/50 bg-background">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">Nav pēdējās aktivitātes</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Jūsu pasūtījumi, piegādes un paziņojumi parādīsīsies šeit.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
