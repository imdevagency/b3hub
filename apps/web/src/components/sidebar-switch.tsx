/**
 * SidebarSwitch — client component that picks between AdminSidebar and AppSidebar
 * based on the authenticated user's type.
 * Used in the dashboard layout (server component) so the sidebar selection
 * can happen client-side after hydration.
 */
'use client';

import { useAuth } from '@/lib/auth-context';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AppSidebar } from '@/components/app-sidebar';

export function SidebarSwitch() {
  const { user } = useAuth();

  if (user?.userType === 'ADMIN') {
    return <AdminSidebar />;
  }

  return <AppSidebar />;
}
