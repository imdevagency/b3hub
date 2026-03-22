/**
 * Containers page — /dashboard/containers
 * Redirects to /dashboard/orders where containers are shown as a tab in BuyerView.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ContainersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/orders');
  }, [router]);

  return null;
}
