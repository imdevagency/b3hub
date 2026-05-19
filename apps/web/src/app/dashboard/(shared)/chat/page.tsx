/**
 * Messages / Bilt Support page — /dashboard/chat
 *
 * Direct peer-to-peer messaging between buyers, sellers, carriers, and drivers
 * is not supported. All contact goes through Bilt (Schüttflix "Smooth Contacts"
 * model). This page explains the contact model and provides links to Bilt
 * support and notifications.
 */
'use client';

import Link from 'next/link';
import { MessageSquare, Bell, HelpCircle, PhoneCall } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export default function ChatPage() {
  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Bilt Atbalsts"
        description="Visi jautājumi tiek risināti caur Bilt — jūsu vienīgo kontaktpartneri."
      />

      {/* Contact model explanation */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Viens kontakts visiem
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bilt ir jūsu līgumpartneris — ne pircējs, ne pārdevējs, ne autovadītājs.
              Nav tiešas saziņas starp darījumu pusēm — visi jautājumi, problēmas
              un strīdi tiek risināti caur Bilt atbalsta komandu.
            </p>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/notifications"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Paziņojumi</p>
            <p className="text-xs text-muted-foreground">Pasūtījumu atjauninājumi un statusi</p>
          </div>
        </Link>

        <Link
          href="/dashboard/help"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <HelpCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Palīdzība</p>
            <p className="text-xs text-muted-foreground">Biežāk uzdotie jautājumi un vadlīnijas</p>
          </div>
        </Link>
      </div>

      {/* Info note */}
      <p className="mt-6 text-xs text-muted-foreground">
        Mobilās aplikācijas atbalsta čats ir pieejams <strong>Ziņojumi → Rakstīt Bilt atbalstam</strong>.
        Telefona atbalsts: darba dienās 8:00–18:00.
      </p>
    </div>
  );
}
