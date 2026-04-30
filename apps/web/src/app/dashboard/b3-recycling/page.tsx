/**
 * B3 Recycling — Admin overview
 * /dashboard/b3-recycling
 *
 * Hub page for the Gulbene licensed recycling facility.
 * Shows quick-access cards to sub-sections. Data will be populated
 * once the backend endpoints for inbound recycling jobs are built.
 */
'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList, FileText, MapPin, Recycle, Truck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS = [
  {
    title: 'Ienākošie darbi',
    description: 'Tiešsaistē rezervētie atkritumu pieņemšanas darbi Gulbenes objektā.',
    icon: Truck,
    href: '/dashboard/b3-recycling/jobs',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Atkritumu žurnāls',
    description: 'Pieņemto atkritumu apjomi pa veidiem: betons, augsne, drupas, metāli, koks.',
    icon: ClipboardList,
    href: '/dashboard/b3-recycling/waste-log',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'Sertifikāti',
    description: 'Izsniegtie atkritumu nodošanas sertifikāti un atbilstības dokumenti.',
    icon: FileText,
    href: '/dashboard/b3-recycling/certificates',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    title: 'Gulbenes lauks',
    description: 'Darba laiki, pakalpojumi un lauka iestatījumi B3 Recycling objektam.',
    icon: MapPin,
    href: '/dashboard/admin/b3-fields',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
];

export default function B3RecyclingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B3 Recycling"
        description="Gulbenes licencētā būvgružu pārstrādes objekta pārvaldība"
      />

      {/* Status banner — placeholder until backend is wired */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Recycle className="h-4 w-4 shrink-0" />
        <span>Šī sadaļa tiek veidota. Ienākošo darbu pārvaldība būs pieejama drīzumā.</span>
      </div>

      {/* Quick-access section cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.href}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(section.href)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${section.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${section.color}`} />
                  </div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{section.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
