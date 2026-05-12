/**
 * Payment success landing page — /skip-hire/[id]/payment-success
 * Paysera redirects here after a successful skip-hire order payment.
 */
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const REDIRECT_DELAY_MS = 5000;

export default function SkipHirePaymentSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(`/dashboard/orders/${id}`);
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-6">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle2 className="size-12 text-green-600" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Maksājums veiksmīgs!</h1>
            <p className="text-muted-foreground text-sm">
              Jūsu konteinera pasūtījums ir apstiprināts. Pārvadātājs drīzumā sazināsies par
              piegādes laiku.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Button asChild>
              <Link href={`/dashboard/orders/${id}`}>
                <Trash2 className="size-4 mr-2" />
                Skatīt pasūtījumu
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/orders">
                Visi pasūtījumi
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Automātiski novirzīs uz pasūtījumu pēc {REDIRECT_DELAY_MS / 1000} sekundēm…
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
