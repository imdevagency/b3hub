/**
 * Construction portal layout — /dashboard/construction/**
 *
 * Feature gate: only users whose company has CONSTRUCTION_MANAGEMENT enabled
 * can access these pages. Everyone else is redirected to /dashboard/buyer.
 *
 * This single layout protects all child routes automatically.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageSpinner } from '@/components/ui/page-spinner';

export default function ConstructionLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const hasAccess = user?.company?.features?.includes('CONSTRUCTION_MANAGEMENT');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!hasAccess) {
      router.replace('/dashboard/buyer');
    }
  }, [user, isLoading, hasAccess, router]);

  if (isLoading || !user) return <PageSpinner />;
  if (!hasAccess) return <PageSpinner />; // brief flash while redirect fires

  return <>{children}</>;
}
