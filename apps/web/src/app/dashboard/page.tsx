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
    router.replace(ROLE_HOME[activeMode]);
  }, [user, isLoading, activeMode, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
    </div>
  );
}
