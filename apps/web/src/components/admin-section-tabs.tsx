'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getAdminNavGroup } from '@/lib/admin-nav-groups';

/**
 * Horizontal tab strip rendered at the top of each admin page that belongs
 * to a nav group (Operations, Orders, Finance, People, Catalog, Config).
 *
 * Rendered by the admin layout — no changes needed in individual pages.
 * Returns null on the dashboard root and any page not in a group.
 *
 * Positioning: negative margins cancel the p-6/p-8 padding applied by
 * the parent dashboard shell, so the tab strip spans the full width and
 * sits flush against the top of the content area.
 */
export function AdminSectionTabs() {
  const pathname = usePathname();
  const group = getAdminNavGroup(pathname);

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
