/**
 * Dashboard home page — /dashboard
 * Role-aware redirect: sends BUYERs to /dashboard/buyer, SUPPLIERs to /dashboard/supplier,
 * CARRIERs to /dashboard/transporter, and ADMINs to /dashboard/admin.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode, type Mode } from '@/lib/mode-context';

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
};

export default function DashboardRedirectPage() {
  const { user, isLoading } = useAuth();
  const { activeMode } = useMode();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.userType === 'ADMIN') {
      router.replace('/dashboard/admin');
      return;
    }
    router.replace(ROLE_HOME[activeMode]);
  }, [user, isLoading, activeMode, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}
