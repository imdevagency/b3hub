const fs = require('fs');

const content = `/**
 * Order hub page — /dashboard/order
 * Central entry point for all services.
 */
import Link from 'next/link';
import { HardHat, Package, Trash2, Truck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

const SERVICES = [
  {
    id: 'materials',
    title: 'Materiāli',
    description: 'Smiltis, grants, šķembas u.c.',
    icon: HardHat,
    href: '/dashboard/catalog',
    color: 'text-amber-700',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'container',
    title: 'Konteineri',
    description: 'Konteineru noma un piegāde',
    icon: Package,
    href: '/dashboard/order/skip-hire',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-500/10',
  },
  {
    id: 'disposal',
    title: 'Utilizācija',
    description: 'Atkritumu izvešana',
    icon: Trash2,
    href: '/dashboard/order/disposal',
    color: 'text-red-700',
    bgColor: 'bg-red-500/10',
  },
  {
    id: 'freight',
    title: 'Transports',
    description: 'Kravu pārvadāšana',
    icon: Truck,
    href: '/dashboard/order/transport',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-500/10',
  },
];

export default function OrderHubPage() {
  return (
    <div className="w-full h-full pb-20 space-y-8">
      <PageHeader 
        title="Pasūtīt"
        description="Izveidojiet jaunu pasūtījumu izvēloties pakalpojumu"
      />
      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SERVICES.map((svc) => {
          const Icon = svc.icon;
          return (
             <Link
              key={svc.id}
              href={svc.href}
              className="group relative rounded-3xl ring-1 ring-black/5 bg-white p-6 md:p-8 shadow-sm hover:shadow-md transition-all duration-200 block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="mt-1">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {svc.title}
                  </h2>
                  <p className="mt-2 text-sm md:text-base text-muted-foreground">
                    {svc.description}
                  </p>
                </div>
                <div
                  className={\`flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-2xl md:rounded-[1.25rem] \${svc.bgColor} group-hover:scale-105 transition-transform duration-300\`}
                >
                  <Icon className={\`h-8 w-8 md:h-10 md:w-10 \${svc.color}\`} strokeWidth={1.5} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('apps/web/src/app/dashboard/order/page.tsx', content);
console.log('Update successful');
