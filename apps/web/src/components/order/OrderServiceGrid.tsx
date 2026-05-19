/**
 * OrderServiceGrid
 *
 * Shared service-picker grid used on both:
 *   /order             (marketing, public — no auth required)
 *   /dashboard/order   (authenticated dashboard)
 *
 * Same cards, same design, same service data. Intentionally mode-agnostic —
 * each card is just a Link; auth is handled downstream in the wizard.
 */
import Link from 'next/link';
import { HardHat, Lock, Truck, Recycle, Pickaxe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ServiceDef {
  id: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'restricted';
}

const SERVICES: ServiceDef[] = [
  {
    id: 'materials',
    href: '/order/materials',
    icon: HardHat,
    title: 'Pirkt būvmateriālus',
    description:
      'Piegādājiet betonu, granti, smiltis un citus materiālus uz jūsu objektu ātri, ērti un laicīgi.',
    badge: 'Cena uzreiz',
  },
  {
    id: 'disposal',
    href: '/order/disposal',
    icon: Recycle,
    title: 'Nodot būvgružus',
    description:
      'Nododiet būvgružus licencētā pieņemšanas punktā. Sertifikāts tiek izsniegts automātiski.',
    badge: 'Cena pēc svara',
  },
  {
    id: 'transport',
    href: '/order/transport',
    icon: Truck,
    title: 'Pasūtīt transportu',
    description: 'Pasūtiet tik daudz pārvadājumu, cik nepieciešams — ātri un vienkārši.',
    badge: 'Tikai uzņēmumiem',
    badgeVariant: 'restricted',
  },
  {
    id: 'seller',
    href: '/karjeriem',
    icon: Pickaxe,
    title: 'Pārdot būvmateriālus',
    description:
      'Pārdodiet savus materiālus bez piepūles. Pasūtījumi, dokumenti un maksājumi — automātiski.',
  },
];

const DASHBOARD_HREFS: Record<string, string> = {
  materials: '/dashboard/catalog',
  disposal: '/dashboard/order/disposal',
  transport: '/dashboard/order/transport',
};

interface Props {
  /** When true, card hrefs point to dashboard routes */
  dashboard?: boolean;
  /** Extra class on the grid wrapper */
  className?: string;
  /** Raw query string (without ?) to append to each service href — e.g. from hero address search */
  addressQuery?: string;
}

export function OrderServiceGrid({ dashboard = false, className, addressQuery }: Props) {
  const services = SERVICES.filter((s) =>
    dashboard ? s.id === 'materials' || s.id === 'disposal' || s.id === 'transport' : true,
  ).map((s) => {
    const base = dashboard ? (DASHBOARD_HREFS[s.id] ?? s.href) : s.href;
    const href = addressQuery ? `${base}?${addressQuery}` : base;
    return { ...s, href };
  });

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-6', className)}>
      {services.map((s) => {
        const Icon = s.icon;
        return (
          <Link
            key={s.id}
            href={s.href}
            className="bg-[#f4f5f4] rounded-[2rem] p-10 flex flex-col group"
          >
            <div className="flex justify-between items-start mb-14">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <Icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                <span>{s.title}</span>
              </div>
              {s.badge &&
                (s.badgeVariant === 'restricted' ? (
                  <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Lock className="size-3 shrink-0" />
                    {s.badge}
                  </span>
                ) : (
                  <span className="bg-[#1a362a] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {s.badge}
                  </span>
                ))}
            </div>
            <h2 className="text-[2rem] leading-[1.1] font-bold mb-4 tracking-tight">{s.title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-10 flex-1">
              {s.description}
            </p>
            <div className="mt-auto">
              <span className="inline-flex border border-[#1a362a]/20 bg-transparent text-sm font-semibold rounded-full px-5 py-2.5 group-hover:bg-white group-hover:border-transparent group-hover:shadow-sm transition-all text-[#1a362a]">
                Pasūtīt
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
