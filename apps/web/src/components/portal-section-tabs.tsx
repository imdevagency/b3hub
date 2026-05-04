'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMode } from '@/lib/mode-context';
import { getPortalNavGroup, type Mode } from '@/lib/portal-nav-groups';

/**
 * Horizontal tab strip rendered above each portal page that belongs to a nav
 * group (e.g. Pasūtījumi, Finanses, Darbi, Projekti).
 *
 * - Reads the active mode from ModeContext so the correct role-specific tabs
 *   are shown (BUYER /dashboard/orders ≠ SUPPLIER /dashboard/orders).
 * - Returns null on home/dashboard root pages and any page not in a group.
 * - Injected automatically by the (platform) layout — no per-page changes needed.
 */
export function PortalSectionTabs() {
  const pathname = usePathname();
  const { activeMode } = useMode();
  const group = getPortalNavGroup(pathname, activeMode as Mode);

  if (!group) return null;

  return (
    <div className="-mx-6 xl:-mx-8 -mt-6 xl:-mt-8 mb-6 xl:mb-8 border-b border-gray-200 bg-white px-6 xl:px-8">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mr-4 shrink-0">
          {group.label}
        </span>
        <nav className="flex gap-1 overflow-x-auto scrollbar-none py-0.5" aria-label={group.label}>
          {group.tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
