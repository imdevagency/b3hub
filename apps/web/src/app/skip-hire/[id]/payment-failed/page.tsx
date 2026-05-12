/**
 * Payment failure landing page — /skip-hire/[id]/payment-failed
 * Paysera redirects here when a skip-hire payment attempt is cancelled or fails.
 */
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function SkipHirePaymentFailedPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-6">
          <div className="rounded-full bg-red-100 p-4">
            <XCircle className="size-12 text-red-500" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Maksājums neizdevās</h1>
            <p className="text-muted-foreground text-sm">
              Maksājums tika atcelts vai radās kļūda. Pasūtījums ir saglabāts — varat mēģināt
              vēlreiz.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Button asChild>
              <Link href={`/dashboard/orders/${id}`}>
                <RotateCcw className="size-4 mr-2" />
                Mēģināt vēlreiz
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/orders">
                Visi pasūtījumi
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
