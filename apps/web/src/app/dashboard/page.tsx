'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  BarChart3,
  Banknote,
  Car,
  CheckCircle,
  FolderOpen,
  Inbox,
  LayoutGrid,
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

function getRoleStats(
  userType: string,
  canTransport: boolean,
  data: DashboardStats | null,
): Stat[] {
  const n = (v: number | undefined) => (v !== undefined ? String(v) : '—');
  const money = (v: number | undefined) =>
    v !== undefined ? `€${Math.round(v).toLocaleString('lv-LV')}` : '—';

  const map: Record<string, Stat[]> = {
    BUYER: [
      {
        label: 'Aktīvie Pasūtījumi',
        value: n(data?.activeOrders),
        icon: ShoppingCart,
        hint: 'Pasūtījumi procesā',
      },
      {
        label: 'Konteineru Pasūtījumi',
        value: n(data?.myOrders),
        icon: Trash2,
        hint: 'Skip hire pasūtījumi',
      },
      {
        label: 'Gaida Piegāde',
        value: n(data?.awaitingDelivery),
        icon: Truck,
        hint: 'Gaida piegādi',
      },
      {
        label: 'Mani Dokumenti',
        value: n(data?.documents),
        icon: FolderOpen,
        hint: 'Rēķini un lapas',
      },
    ],
    SUPPLIER: [
      {
        label: 'Aktīvie Sludinājumi',
        value: n(data?.activeListings),
        icon: Package,
        hint: 'Publicēti produkti',
      },
      {
        label: 'Gaida Pasūtījumi',
        value: n(data?.pendingOrders),
        icon: ShoppingCart,
        hint: 'Gaida izpildi',
      },
      {
        label: 'Mēneša Ieņēmumi',
        value: money(data?.monthlyRevenue),
        icon: TrendingUp,
        hint: 'Šajā mēnesī',
      },
      {
        label: 'Mani Dokumenti',
        value: n(data?.documents),
        icon: FolderOpen,
        hint: 'Rēķini un līgumi',
      },
    ],
    CARRIER: [
      {
        label: 'Aktīvie Darbi',
        value: n(data?.activeJobs),
        icon: MapPin,
        hint: 'Piešķirtais transports',
      },
      {
        label: 'Pabeigti Šodien',
        value: n(data?.completedToday),
        icon: CheckCircle,
        hint: 'Piegādāts šodien',
      },
      {
        label: 'Gaida Samaksa',
        value: n(data?.awaitingPayment),
        icon: Banknote,
        hint: 'Gaida maksājumu',
      },
      {
        label: 'Mans Autoparks',
        value: n(data?.vehicleCount),
        icon: Car,
        hint: 'Reģistrētie transportlīdzekļi',
      },
    ],
  };

  const stats = map[userType] ?? map.BUYER;

  // Inject vehicle stat for non-CARRIER users who have transport capability
  if (canTransport && userType !== 'CARRIER') {
    return [
      ...stats.slice(0, -1), // all except the last (Mani Dokumenti)
      {
        label: 'Mans Autoparks',
        value: n(data?.vehicleCount),
        icon: Car,
        hint: 'Reģistrētie transportlīdzekļi',
      },
      stats[stats.length - 1], // Mani Dokumenti last
    ];
  }

  return stats;
}

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
      label: 'Mans Autoparks',
      description: 'Pievienot un pārvaldīt savus transportlīdzekļus',
      icon: Car,
      href: '/dashboard/garage',
      primary: true,
    },
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
};

const ROLE_LABEL: Record<string, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
  ADMIN: 'Administrators',
};

const ROLE_TAGLINE: Record<string, string> = {
  BUYER: 'Pasūtīt materiālus, konteinerus un pārvaldīt piegādes.',
  SUPPLIER: 'Pārvaldīt savus sludinājumus un izpildīt ienākošos pasūtījumus.',
  CARRIER: 'Skatīt savus transporta darbus un izsekot ieņēkumiem.',
  CARRIER_DISPATCHER: 'Pārvaldiet floti, piešķiriet šoferus un uzraugiet visus aktīvos darbus.',
  ADMIN: 'Pārvaldīt platformu un uzraudzīt visas darbības.',
};

// ── Component ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && token) {
      getDashboardStats(token)
        .then(setStatsData)
        .catch(() => {});
    }
  }, [user, token]);

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  const stats = getRoleStats(user.userType, user.canTransport ?? false, statsData);
  const baseActions = ROLE_ACTIONS[user.userType] ?? ROLE_ACTIONS.BUYER;
  const isDispatcher = user.isCompany && (user.canTransport || user.userType === 'CARRIER');
  const actions = isDispatcher
    ? [
        {
          label: 'Dispečera Panelis',
          description: 'Flotes statuss, aktīvie darbi, šoferu pārskatīšana',
          icon: LayoutGrid,
          href: '/dashboard/fleet',
          primary: true,
        } as Action,
        ...baseActions.filter((a) => a.href !== '/dashboard/fleet'),
      ]
    : (user.canTransport ?? false) && user.userType !== 'CARRIER'
      ? [
          ...baseActions.slice(0, 1),
          {
            label: 'Mans Autoparks',
            description: 'Pievienot un pārvaldīt savus transportlīdzekļus',
            icon: Car,
            href: '/dashboard/garage',
            primary: true,
          } as Action,
          ...baseActions.slice(1),
        ]
      : baseActions;
  const label = isDispatcher ? 'Dispečers' : (ROLE_LABEL[user.userType] ?? user.userType);

  return (
    <div className="space-y-8">
      {/* ── Welcome ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Laipni atgriezties, {user.firstName}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_TAGLINE[isDispatcher ? 'CARRIER_DISPATCHER' : user.userType] ??
              'Pārvaldiet savu kontu.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {label}
          </span>
          {user.userType === 'BUYER' && (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {user.isCompany ? '🏢 Uzņēmums' : '👤 Privātpersona'}
            </span>
          )}
        </div>
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
