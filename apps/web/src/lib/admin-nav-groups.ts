/**
 * Admin navigation group definitions.
 *
 * Single source of truth used by:
 *  - AdminSidebar (which of 7 items is "active")
 *  - AdminSectionTabs (which tab strip to show on a given page)
 *
 * Rule: Sidebar = 7 business domains. Tabs = views within that domain.
 */

export type AdminNavTab = {
  label: string;
  href: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  /** The href the sidebar item points to (first/most-used tab) */
  primaryHref: string;
  tabs: AdminNavTab[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'operations',
    label: 'Operācijas',
    primaryHref: '/dashboard/admin/triage',
    tabs: [
      { label: 'Triāža', href: '/dashboard/admin/triage' },
      { label: 'Dispečerizācija', href: '/dashboard/admin/dispatch' },
      { label: 'SLA', href: '/dashboard/admin/sla' },
    ],
  },
  {
    id: 'orders',
    label: 'Pasūtījumi',
    primaryHref: '/dashboard/admin/orders',
    tabs: [
      { label: 'Pasūtījumi', href: '/dashboard/admin/orders' },
      { label: 'Transporta darbi', href: '/dashboard/admin/jobs' },
      { label: 'RFQ', href: '/dashboard/admin/rfqs' },
      { label: 'Pamatlīgumi', href: '/dashboard/admin/framework-contracts' },
      { label: 'Dokumenti', href: '/dashboard/admin/documents' },
    ],
  },
  {
    id: 'finance',
    label: 'Finanses',
    primaryHref: '/dashboard/admin/finances',
    tabs: [
      { label: 'Pārskats', href: '/dashboard/admin/finances' },
      { label: 'Rēķini', href: '/dashboard/admin/invoices' },
      { label: 'Izmaksas', href: '/dashboard/admin/payouts' },
      { label: 'Maksājumi', href: '/dashboard/admin/payments' },
      { label: 'Piemaksas', href: '/dashboard/admin/surcharges' },
    ],
  },
  {
    id: 'people',
    label: 'Dalībnieki',
    primaryHref: '/dashboard/admin/users',
    tabs: [
      { label: 'Lietotāji', href: '/dashboard/admin/users' },
      { label: 'Uzņēmumi', href: '/dashboard/admin/companies' },
      { label: 'Pieteikumi', href: '/dashboard/admin/applications' },
      { label: 'Piegādātāji', href: '/dashboard/admin/suppliers' },
      { label: 'Pārstrādes centri', href: '/dashboard/admin/recycling-centers' },
      { label: 'Partneru līgumi', href: '/dashboard/admin/partner-contracts' },
    ],
  },
  {
    id: 'catalog',
    label: 'Katalogs',
    primaryHref: '/dashboard/admin/catalog',
    tabs: [
      { label: 'Katalogs', href: '/dashboard/admin/catalog' },
      { label: 'Tirgus veselība', href: '/dashboard/admin/market-health' },
      { label: 'Tirgus atbilstība', href: '/dashboard/admin/market-match' },
      { label: 'Pieprasījuma trūkumi', href: '/dashboard/admin/demand-gaps' },
      { label: 'Projekti', href: '/dashboard/admin/projects' },
      { label: 'Aprites signāli', href: '/dashboard/admin/waste-signals' },
    ],
  },
  {
    id: 'config',
    label: 'Konfigurācija',
    primaryHref: '/dashboard/admin/config',
    tabs: [
      { label: 'Vispārīgi', href: '/dashboard/admin/config' },
      { label: 'Komisijas', href: '/dashboard/admin/fee-config' },
      { label: 'Karodziņi', href: '/dashboard/admin/feature-flags' },
      { label: 'Iestatījumi', href: '/dashboard/admin/settings' },
      { label: 'Izsūtīšana', href: '/dashboard/admin/broadcast' },
      { label: 'Audits', href: '/dashboard/admin/audit-logs' },
    ],
  },
  {
    id: 'reports',
    label: 'Atskaites',
    primaryHref: '/dashboard/admin/analytics',
    tabs: [
      { label: 'Analītika', href: '/dashboard/admin/analytics' },
      { label: 'Mārketings', href: '/dashboard/admin/marketing' },
      { label: 'Rezultātu karte', href: '/dashboard/admin/scorecard' },
      { label: 'Aprites plūsma', href: '/dashboard/admin/circular-flow' },
    ],
  },
];

/**
 * Returns the group that contains the given pathname, or null.
 * Matches exact path or any sub-path (e.g. /admin/orders/[id]).
 */
export function getAdminNavGroup(pathname: string): AdminNavGroup | null {
  return (
    ADMIN_NAV_GROUPS.find((g) =>
      g.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + '/')),
    ) ?? null
  );
}

/** All paths (across all groups) — used for group-aware active state in sidebar. */
export function getGroupForPath(href: string): AdminNavGroup | null {
  return ADMIN_NAV_GROUPS.find((g) => g.primaryHref === href) ?? null;
}
