/**
 * B3 Construction — Admin overview
 * /dashboard/b3-construction
 *
 * Hub page for the B3 groundworks subcontracting business.
 * Internal project tracker — no client-facing portal.
 */
'use client';

import { useRouter } from 'next/navigation';
import { FolderKanban, TrendingDown, Truck, FileText, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS = [
  {
    title: 'Projekti',
    description:
      'Visi zemdarbu projekti ar izmaksu izsekošanu, bruto peļņas aprēķinu un pasūtījumu saistīšanu.',
    icon: FolderKanban,
    href: '/dashboard/b3-construction/projects',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    title: 'Klienti',
    description:
      'Pasūtītāji — uzņēmumi, kuri pieprasa zemdarbu pakalpojumus. Jaunus klientus var pievienot šeit.',
    icon: Users,
    href: '/dashboard/b3-construction/clients',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    title: 'Atkritumu izvešana',
    description:
      'Projektu atkritumu izvešanas pasūtījumi, apjomi pa atkritumu veidiem un B3 Recycling nodošana.',
    icon: Truck,
    href: '/dashboard/b3-construction/disposal',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Izdevumi',
    description: 'Materiālu izmaksu dinamika pa projektiem un mēnešiem.',
    icon: TrendingDown,
    href: '/dashboard/b3-construction/projects',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    title: 'Dokumenti',
    description: 'Darbu izpildes akti, piegādes čeki un ietvarlīgumi.',
    icon: FileText,
    href: '/dashboard/b3-construction/projects',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
];

export default function B3ConstructionPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B3 Construction"
        description="Zemdarbu apakšuzņēmēja projektu pārvaldība — iekšēja lietošana"
      />

      {/* Quick-access section cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.title}
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
