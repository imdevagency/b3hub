/**
 * Dispatcher Panel — /dashboard/fleet
 * Merged into /dashboard/active (the canonical ops-centre view).
 * This stub exists so existing bookmarks/links don't break.
 * It is also listed in next.config.ts redirects for a zero-JS redirect.
 */
import { redirect } from 'next/navigation';

export default function FleetRedirect() {
  redirect('/dashboard/active');
}
