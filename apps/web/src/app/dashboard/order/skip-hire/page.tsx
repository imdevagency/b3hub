/**
 * Skip-hire order page — /dashboard/order/skip-hire
 * Multi-step form for hiring a skip: size selection, address, and date booking.
 */
'use client';

import { useAuth } from '@/lib/auth-context';
import { OrderWizard } from '@/components/order/OrderWizard';
import { ArrowLeft, Recycle, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';

const TRUST_BADGES = [
  { icon: Truck, label: 'Piegāde nākamajā dienā', sub: 'Pasūtīiet līdz plkst. 14:00' },
  { icon: ShieldCheck, label: 'Pilnīgi licenzēts', sub: 'Sertificēta atkritumu izvešana' },
  { icon: Recycle, label: 'Videi draudzīgs', sub: '85% pārstrādes rādītājs' },
];

export default function SkipHirePage() {
  const { token } = useAuth();

  return (
    <div className="space-y-8">
      {/* Back link + header */}
      <div>
        <Link
          href="/dashboard/order"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Atpakaļ uz pasūtījumu centru
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Pasūtīt Konteineru</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pasūtījums tiks piesaistīts jūsu kontam un būs redzams pasūtījumu vēsturē.
        </p>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap gap-6">
        {TRUST_BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.label} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                <Icon className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                <p className="text-xs text-gray-500">{b.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Wizard */}
      <OrderWizard token={token ?? undefined} />
    </div>
  );
}
