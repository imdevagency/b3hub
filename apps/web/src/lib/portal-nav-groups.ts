/**
 * Portal navigation group definitions — web portal (non-admin roles).
 *
 * Single source of truth used by:
 *  - AppSidebar (group-aware active state on collapsed 5-item nav)
 *  - PortalSectionTabs (tab strip rendered above each portal page)
 *
 * Rule: Sidebar = business domains (max 5–6). Tabs = views of the same concept.
 *
 * Groups are keyed by Mode so that shared routes like /dashboard/orders
 * show role-correct tabs (buyer orders ≠ supplier incoming orders).
 */

export type Mode = 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'RECYCLER';

export type PortalNavTab = {
  label: string;
  href: string;
};

export type PortalNavGroup = {
  id: string;
  label: string;
  /** The href the sidebar item points to (primary/landing tab) */
  primaryHref: string;
  tabs: PortalNavTab[];
};

export const PORTAL_NAV_GROUPS: Record<Mode, PortalNavGroup[]> = {
  // ── Buyer ──────────────────────────────────────────────────────────────────
  BUYER: [
    {
      id: 'orders',
      label: 'Pasūtījumi',
      primaryHref: '/dashboard/orders',
      tabs: [
        { label: 'Visi pasūtījumi', href: '/dashboard/orders' },
        { label: 'Grafiki', href: '/dashboard/orders/schedules' },
        { label: 'Piegādes', href: '/dashboard/deliveries' },
        { label: 'Strīdi', href: '/dashboard/disputes' },
      ],
    },
    {
      id: 'procurement',
      label: 'Iepirkumi',
      primaryHref: '/dashboard/catalog',
      tabs: [
        { label: 'Katalogs', href: '/dashboard/catalog' },
        { label: 'Cenu aptauja', href: '/dashboard/quote-requests' },
        { label: 'Pamatlīgumi', href: '/dashboard/framework-contracts' },
        { label: 'Projekti', href: '/dashboard/projects' },
      ],
    },
    {
      id: 'finance',
      label: 'Finanses',
      primaryHref: '/dashboard/invoices',
      tabs: [
        { label: 'Rēķini', href: '/dashboard/invoices' },
        { label: 'Dokumenti', href: '/dashboard/documents' },
        { label: 'Analītika', href: '/dashboard/analytics' },
      ],
    },
  ],

  // ── Supplier ───────────────────────────────────────────────────────────────
  SUPPLIER: [
    {
      id: 'work',
      label: 'Darbi',
      primaryHref: '/dashboard/orders',
      tabs: [
        { label: 'Ienākošie', href: '/dashboard/orders' },
        { label: 'Piegādes', href: '/dashboard/deliveries' },
        { label: 'RFQ tirgus', href: '/dashboard/quote-requests/open' },
        { label: 'Pieprasījumi', href: '/dashboard/quote-requests' },
      ],
    },
    {
      id: 'catalog',
      label: 'Katalogs',
      primaryHref: '/dashboard/portfolio',
      tabs: [
        { label: 'Kopskats', href: '/dashboard/portfolio' },
        { label: 'Materiāli', href: '/dashboard/materials' },
        { label: 'Tualetes kabīnes', href: '/dashboard/toilet-cabins' },
        { label: 'Konteineri', href: '/dashboard/skip-hire/fleet' },
        { label: 'Tehnika', href: '/dashboard/equipment-rentals/catalog' },
        { label: 'Karjeri', href: '/dashboard/locations' },
      ],
    },
    {
      id: 'finance',
      label: 'Finanses',
      primaryHref: '/dashboard/earnings',
      tabs: [
        { label: 'Ieņēmumi', href: '/dashboard/earnings' },
        { label: 'Dokumenti', href: '/dashboard/documents' },
        { label: 'Analītika', href: '/dashboard/analytics' },
      ],
    },
  ],

  // ── Carrier ────────────────────────────────────────────────────────────────
  CARRIER: [
    {
      id: 'work',
      label: 'Darbi',
      primaryHref: '/dashboard/jobs',
      tabs: [
        { label: 'Darbu tirgus', href: '/dashboard/jobs' },
        { label: 'Piegādes', href: '/dashboard/deliveries' },
        { label: 'Utilizācija', href: '/dashboard/recycling-centers' },
        { label: 'Vēsture', href: '/dashboard/transport-history' },
      ],
    },
    {
      id: 'fleet',
      label: 'Flote',
      primaryHref: '/dashboard/fleet-management',
      tabs: [
        { label: 'Transportlīdzekļi', href: '/dashboard/fleet-management' },
        { label: 'Skip flote', href: '/dashboard/skip-hire/fleet' },
        { label: 'Iestatījumi', href: '/dashboard/transporter/settings' },
      ],
    },
    {
      id: 'finance',
      label: 'Finanses',
      primaryHref: '/dashboard/earnings',
      tabs: [
        { label: 'Ienākumi', href: '/dashboard/earnings' },
        { label: 'Dokumenti', href: '/dashboard/documents' },
        { label: 'Analītika', href: '/dashboard/analytics' },
      ],
    },
  ],

  // ── Recycler ───────────────────────────────────────────────────────────────
  RECYCLER: [
    {
      id: 'work',
      label: 'Darbi',
      primaryHref: '/dashboard/recycling/jobs',
      tabs: [
        { label: 'Ienākošie darbi', href: '/dashboard/recycling/jobs' },
        { label: 'Atkritumu žurnāls', href: '/dashboard/recycling/waste-records' },
      ],
    },
    {
      id: 'pricing',
      label: 'Cenas',
      primaryHref: '/dashboard/recycling/pricing',
      tabs: [
        { label: 'Cenas noteikumi', href: '/dashboard/recycling/pricing' },
      ],
    },
    {
      id: 'docs',
      label: 'Dokumenti',
      primaryHref: '/dashboard/documents',
      tabs: [
        { label: 'Dokumenti', href: '/dashboard/documents' },
        { label: 'Analītika', href: '/dashboard/analytics' },
      ],
    },
  ],
};

/**
 * Returns the group for the current pathname + role combination.
 * Only groups with ≥2 tabs are returned (no strip needed for single-page groups).
 */
export function getPortalNavGroup(
  pathname: string,
  mode: Mode,
): PortalNavGroup | null {
  const groups = PORTAL_NAV_GROUPS[mode] ?? [];
  return (
    groups.find(
      (g) =>
        g.tabs.length > 1 &&
        g.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + '/')),
    ) ?? null
  );
}

/**
 * All paths within a group for a given mode — used for group-aware active
 * state in the sidebar.
 */
export function getGroupPaths(mode: Mode, groupId: string): string[] {
  const group = (PORTAL_NAV_GROUPS[mode] ?? []).find((g) => g.id === groupId);
  return group?.tabs.map((t) => t.href) ?? [];
}
