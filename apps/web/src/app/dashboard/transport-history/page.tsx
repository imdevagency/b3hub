/**
 * Transport History — /dashboard/transport-history
 * Consolidated into /dashboard/orders (carrier tab).
 * This stub exists so bookmarks/links don't break.
 * Also listed in next.config.ts redirects for a zero-JS redirect.
 */
import { redirect } from 'next/navigation';

export default function TransportHistoryRedirect() {
  redirect('/dashboard/orders');
}
