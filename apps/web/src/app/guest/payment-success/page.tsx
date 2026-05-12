/**
 * Guest payment success landing page — /guest/payment-success
 * Paysera redirects B2C (guest) buyers here after a successful payment.
 * No auth required — buyer may not have an account.
 */
'use client';

import Link from 'next/link';
import { CheckCircle2, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function GuestPaymentSuccessPage() {
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
              Jūsu pasūtījums ir saņemts un tiek apstrādāts. Apstiprinājums tiks nosūtīts uz jūsu
              e-pasta adresi.
            </p>
          </div>

          {/* Nudge to create an account */}
          <div className="w-full rounded-lg border border-border bg-muted/40 p-4 flex flex-col gap-3 text-left">
            <p className="text-sm font-medium">Sekojiet pasūtījumam reāllaikā</p>
            <p className="text-xs text-muted-foreground">
              Izveidojiet kontu, lai izsekotu piegādi, saņemtu rēķinus un atkārtoti pasūtītu ar
              vienu klikšķi.
            </p>
            <Button size="sm" asChild>
              <Link href="/register">
                <UserPlus className="size-4 mr-2" />
                Izveidot kontu
              </Link>
            </Button>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              Atpakaļ uz sākumlapu
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
