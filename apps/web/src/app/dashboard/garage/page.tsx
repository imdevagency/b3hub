import { redirect } from 'next/navigation';

// Superseded by the unified Fleet Management page (/dashboard/fleet-management).
export default function GarageRedirect() {
  redirect('/dashboard/fleet-management');
}
