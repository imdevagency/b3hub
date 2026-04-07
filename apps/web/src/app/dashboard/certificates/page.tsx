/**
 * Certificates page — redirects to /dashboard/documents.
 * The certificates view is part of the unified Documents hub.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CertificatesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/documents');
  }, [router]);
  return null;
}
