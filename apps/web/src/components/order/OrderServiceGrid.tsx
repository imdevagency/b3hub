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
import { HardHat, Package, Trash2, Truck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ServiceDef {
  id: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  badge?: string;
}

const SERVICES: ServiceDef[] = [
  {
    id: 'materials',
    href: '/order/materials',
    icon: HardHat,
    title: 'Materiāli',
    description: 'Smiltis, grants, šķembas, betons — piegāde tieši uz jūsu objektu.',
    badge: 'Cena uzreiz',
  },
  {
    id: 'skip-hire',
    href: '/order/skip-hire',
    icon: Package,
    title: 'Konteineri',
    description: 'Konteiners ieved uz vietu, jūs to piepildāt — mēs aizvedām.',
    badge: 'No €59',
  },
  {
    id: 'disposal',
    href: '/order/disposal',
    icon: Trash2,
    title: 'Utilizācija',
    description: 'Kravas auto iebrauc jūsu objektā, iekrauj atkritumus un aizved.',
    badge: 'Cena pēc svara',
  },
  {
    id: 'transport',
    href: '/dashboard/order/transport',
    icon: Truck,
    title: 'Transports',
    description: 'Jebkuras kravas pārvadāšana visā Latvijas teritorijā.',
    badge: 'B2B',
  },
];

const DASHBOARD_HREFS: Record<string, string> = {
  materials: '/dashboard/catalog',
  'skip-hire': '/dashboard/order/skip-hire',
  disposal: '/dashboard/order/disposal',
  transport: '/dashboard/order/transport',
};

interface Props {
  /** When true, card hrefs point to dashboard routes */
  dashboard?: boolean;
  /** Extra class on the grid wrapper */
  className?: string;
}

export function OrderServiceGrid({ dashboard = false, className }: Props) {
  const services = SERVICES.map((s) => ({
    ...s,
    href: dashboard ? (DASHBOARD_HREFS[s.id] ?? s.href) : s.href,
  }));

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>
      {services.map((s) => {
        const Icon = s.icon;
        return (
          <Link
            key={s.id}
            href={s.href}
            className="group relative flex flex-col justify-between rounded-[1.75rem] bg-muted/40 hover:bg-muted/70 border border-transparent hover:border-border/40 p-7 md:p-9 transition-all duration-200 active:scale-[0.98]"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-background shadow-sm group-hover:shadow-md transition-shadow">
                  <Icon className="size-7 text-foreground" strokeWidth={1.5} />
                </div>
                <ArrowRight className="size-6 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-foreground" />
              </div>

              <h2 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">
                {s.title}
              </h2>
              <p className="text-[15px] font-medium text-muted-foreground leading-relaxed max-w-[90%]">
                {s.description}
              </p>
            </div>

            {s.badge && (
              <div className="mt-8">
                <span className="inline-flex items-center rounded-xl bg-background px-3 py-1.5 text-[12px] font-bold text-foreground shadow-sm">
                  {s.badge}
                </span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
