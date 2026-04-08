/**
 * Transport History — /dashboard/transport-history
 * Dedicated carrier view for reviewing completed and active transport jobs.
 */
'use client';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { CarrierHistoryView } from '../orders/page';

export default function TransportHistoryPage() {
  const { token } = useRequireAuth();

  if (!token) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  return (
    <div className="w-full h-full pb-20 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Mani Darbi</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">
          Pārvadājumu vēsture — pabeigti darbi, ieņēmumi, maršruti
        </p>
      </div>

      <CarrierHistoryView token={token} />
    </div>
  );
}
