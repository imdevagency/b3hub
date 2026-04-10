/**
 * Incoming Orders — /dashboard/incoming-orders
 * Dedicated supplier view for managing orders placed by buyers.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { SupplierView } from '../orders/page';

export default function IncomingOrdersPage() {
  const { token, user, isLoading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !user.canSell) router.replace('/dashboard');
  }, [user, isLoading, router]);

  if (!token || (user && !user.canSell)) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  return (
    <div className="w-full h-full pb-20 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ienākošie Pasūtījumi</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">
          Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti
        </p>
      </div>

      <SupplierView token={token} />
    </div>
  );
}
