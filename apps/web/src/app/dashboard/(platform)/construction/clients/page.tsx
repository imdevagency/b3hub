/**
 * Construction — Clients list (read-only distinct names)
 * /dashboard/construction/clients
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getConstructionClients } from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, RefreshCw, ExternalLink } from 'lucide-react';

export default function ClientsPage() {
  const { session } = useAuth();
  const router = useRouter();
  const token = session?.access_token ?? '';

  const [clients, setClients] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionClients(token);
      setClients(res);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klienti"
        description="Unikālie klienti no jūsu projektiem"
        icon={Building2}
        actions={
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nav klientu"
          description="Pievienojiet klienta nosaukumu, veidojot projektu."
          action={
            <Button onClick={() => router.push('/dashboard/construction/projects')}>
              Uz projektiem
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <Card
              key={client.name}
              className="hover:bg-accent/40 transition-colors cursor-pointer"
              onClick={() =>
                router.push(
                  `/dashboard/construction/projects?client=${encodeURIComponent(client.name)}`,
                )
              }
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{client.name}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
