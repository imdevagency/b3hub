'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

// Map every known dashboard segment (or full sub-path key) to a Latvian label.
const SEGMENT_LABELS: Record<string, string> = {
  // role homes
  buyer: 'Pasūtītājs',
  supplier: 'Piegādātājs',
  transporter: 'Pārvadātājs',
  admin: 'Administrācija',

  // top-level sections
  catalog: 'Pasūtīt Materiālus',
  orders: 'Pasūtījumi',
  materials: 'Materiāli',
  jobs: 'Darbu Tirgus',
  schedule: 'Grafiks',
  invoices: 'Rēķini',
  analytics: 'Analītika',
  documents: 'Dokumenti',
  certificates: 'Sertifikāti',
  chat: 'Ziņojumi',
  settings: 'Iestatījumi',
  company: 'Uzņēmums',
  notifications: 'Paziņojumi',
  reviews: 'Atsauksmes',
  garage: 'Autoparks',
  fleet: 'Flote',
  earnings: 'Ieņēmumi',
  projects: 'Projekti',
  'quote-requests': 'Cenu Pieprasījumi',
  'framework-contracts': 'Ietvarlīgumi',
  'skip-hire': 'Konteineri',
  'recycling-centers': 'Utilizācijas Centri',
  'transport-jobs': 'Transporta Darbi',
  containers: 'Konteineri',
  active: 'Aktīvais Darbs',
  checkout: 'Norēķins',
  order: 'Pasūtījums',
  schedules: 'Regulārie',

  // admin sub-sections
  applications: 'Pieteikumi',
  companies: 'Uzņēmumi',
  disputes: 'Sūdzības',
  users: 'Lietotāji',

  // misc
  team: 'Komanda',
  open: 'Atvērtie',
  fleet2: 'Konteineru Flote',
  disposal: 'Atkritumi',
  'skip-hire-order': 'Konteineru Pasūtījums',
};

function labelFor(segment: string): string {
  // Dynamic segments like [id] → show nothing
  if (segment.startsWith('[') && segment.endsWith(']')) return '';
  return SEGMENT_LABELS[segment] ?? segment;
}

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  // Strip /dashboard prefix — we always show "Dashboard" implicitly via the sidebar logo
  const parts = pathname
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter(Boolean);

  if (parts.length === 0) return [];

  const crumbs: Crumb[] = [];
  let accumulated = '/dashboard';

  for (const part of parts) {
    accumulated += `/${part}`;
    const label = labelFor(part);
    if (label) {
      crumbs.push({ label, href: accumulated });
    }
  }

  return crumbs;
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
            {isLast ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
