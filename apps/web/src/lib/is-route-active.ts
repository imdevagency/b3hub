/**
 * Shared route-active helper for sidebar components.
 *
 * Each sidebar calls this with its own set of root-only hrefs (paths that must
 * match exactly rather than using a prefix match).
 *
 * @example
 *   const isActive = makeIsRouteActive(pathname, ['/dashboard/admin', '/dashboard/group']);
 *   const active = isActive(navItem);
 */

export interface NavItemRef {
  href: string;
  groupPaths?: string[];
}

/**
 * Returns a comparator function that determines whether a nav item is active
 * for the given `pathname`.
 *
 * @param pathname  Current page pathname (from `usePathname()`).
 * @param exactHrefs  Paths that require an exact match (top-level home pages).
 */
export function makeIsRouteActive(
  pathname: string,
  exactHrefs: string[],
): (item: NavItemRef | string) => boolean {
  return (item: NavItemRef | string): boolean => {
    const href = typeof item === 'string' ? item : item.href;
    if (exactHrefs.includes(href)) {
      return pathname === href;
    }
    if (typeof item !== 'string' && item.groupPaths && item.groupPaths.length > 0) {
      return item.groupPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}
