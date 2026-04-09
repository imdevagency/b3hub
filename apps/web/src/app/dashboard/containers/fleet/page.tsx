import { redirect } from 'next/navigation';

// Superseded by the unified Fleet Management page (/dashboard/fleet-management).
export default function ContainerFleetRedirect() {
  redirect('/dashboard/fleet-management');
}
