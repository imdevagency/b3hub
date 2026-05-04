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
      { label: 'Izņēmumi', href: '/dashboard/admin/exceptions' },
      { label: 'Atbalsts', href: '/dashboard/admin/support' },
      { label: 'Strīdi', href: '/dashboard/admin/disputes' },
    ],
  },
  {
    id: 'orders',
    label: 'Pasūtījumi',
    primaryHref: '/dashboard/admin/orders',
    tabs: [
      { label: 'Pasūtījumi', href: '/dashboard/admin/orders' },
      { label: 'Transporta darbi', href: '/dashboard/admin/jobs' },
      { label: 'Skip Hire', href: '/dashboard/admin/skip-hire' },
      { label: 'RFQ', href: '/dashboard/admin/rfqs' },
      { label: 'Pamatlīgumi', href: '/dashboard/admin/framework-contracts' },
      { label: 'Viesa', href: '/dashboard/admin/guest-orders' },
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
      { label: 'B3 Lauki', href: '/dashboard/admin/b3-fields' },
    ],
  },
  {
    id: 'catalog',
    label: 'Katalogs',
    primaryHref: '/dashboard/admin/catalog',
    tabs: [
      { label: 'Katalogs', href: '/dashboard/admin/catalog' },
      { label: 'Materiāli', href: '/dashboard/admin/materials' },
      { label: 'Tirgus motors', href: '/dashboard/admin/marketplace' },
      { label: 'Skip izmēri', href: '/dashboard/admin/skip-sizes' },
      { label: 'Laukumu ops.', href: '/dashboard/admin/field-ops' },
      { label: 'Caurlaides', href: '/dashboard/admin/field-passes' },
      { label: 'Svēršanas taloni', href: '/dashboard/admin/weighing-slips' },
    ],
  },
  {
    id: 'config',
    label: 'Konfigurācija',
    primaryHref: '/dashboard/admin/config',
    tabs: [
      { label: 'Konfigurācija', href: '/dashboard/admin/config' },
      { label: 'Komisijas', href: '/dashboard/admin/fee-config' },
      { label: 'Karodziņi', href: '/dashboard/admin/feature-flags' },
      { label: 'Iestatījumi', href: '/dashboard/admin/settings' },
      { label: 'Izsūtīšana', href: '/dashboard/admin/broadcast' },
      { label: 'Audita žurnāls', href: '/dashboard/admin/audit-logs' },
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
