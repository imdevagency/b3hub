/**
 * PageAnimate
 *
 * Client-side page entry animation wrapper for all dashboard pages.
 * Wraps {children} with a key derived from the current pathname so a
 * fresh animation plays on every navigation — the same subtle fade+rise
 * effect used in Uber's app.
 *
 * Powered by tw-animate-css which is already imported in globals.css.
 * No framer-motion or other extra dependencies needed.
 *
 * Used ONCE in the dashboard layout — do not add it to individual pages.
 *
 * Duration: 250ms — fast enough not to feel laggy on repeated nav.
 * Motion: fade-in + slide 6px up — subtle, not dramatic.
 */
'use client';

import { usePathname } from 'next/navigation';

export function PageAnimate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-[250ms] ease-out"
    >
      {children}
    </div>
  );
}
