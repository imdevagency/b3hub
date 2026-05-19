/**
 * Job chat redirect — /dashboard/chat/[jobId]
 *
 * P2P job chat is not supported. All contact goes through Bilt support.
 * This page redirects to the main chat/support page.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JobChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/chat');
  }, [router]);

  return null;
}
