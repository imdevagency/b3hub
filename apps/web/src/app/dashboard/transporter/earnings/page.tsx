import { redirect } from 'next/navigation';

// Superseded by the unified /dashboard/earnings (role-aware).
export default function EarningsRedirect() {
  redirect('/dashboard/earnings');
}
