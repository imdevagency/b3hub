'use client';

import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PortfolioHubPage() {
  const { user } = useAuth();

  const canSell = !!user?.canSell;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Mans Katalogs"
        description="Pārvaldiet savu materiālu piedāvājumu no viena paneļa."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {canSell && (
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100/50 text-amber-700 rounded-xl">
                  <Package className="size-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Materiāli</h3>
                  <p className="text-sm text-muted-foreground">Smiltis, šķembas, melnzeme u.c.</p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full justify-between mt-2">
                <Link href="/dashboard/materials">
                  Pārvaldīt materiālus <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
