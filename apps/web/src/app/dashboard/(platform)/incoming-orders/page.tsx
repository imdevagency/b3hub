/**
 * Incoming Orders — /dashboard/incoming-orders
 * Consolidated into /dashboard/orders (supplier tab).
 * This stub exists so bookmarks/links don't break.
 * Also listed in next.config.ts redirects for a zero-JS redirect.
 */
import { redirect } from 'next/navigation';

export default function IncomingOrdersRedirect() {
  redirect('/dashboard/orders');
}
