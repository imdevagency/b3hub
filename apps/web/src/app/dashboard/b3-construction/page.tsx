/**
 * B3 Construction — Admin overview
 * /dashboard/b3-construction
 *
 * Hub page for the B3 groundworks subcontracting business.
 * Internal project tracker — no client-facing portal.
 * Priority P1 (B3 Recycling is P0).
 */
'use client';

import { useRouter } from 'next/navigation';
import { FolderKanban, HardHat } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS = [
  {
    title: 'Aktīvie projekti',
    description: 'Aktīvo zemdarbu projektu saraksts ar statusu, objektu un klientu informāciju.',
    icon: FolderKanban,
    href: '/dashboard/b3-construction/projects',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
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

      {/* Status banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <HardHat className="h-4 w-4 shrink-0" />
        <span>Šī sadaļa tiek veidota. Projektu izsekošana būs pieejama drīzumā.</span>
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
