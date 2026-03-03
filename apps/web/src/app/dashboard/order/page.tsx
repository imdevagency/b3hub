'use client';

import { useAuth } from '@/lib/auth-context';
import { OrderWizard } from '@/components/order/OrderWizard';
import { Recycle, ShieldCheck, Truck } from 'lucide-react';

const TRUST_BADGES = [
  { icon: Truck, label: 'Piegāde nākamajā dienā', sub: 'Pasūtīiet līdz plkst. 14:00' },
  { icon: ShieldCheck, label: 'Pilnibīgi licenzēts', sub: 'Sertificēta atkritumu izvešana' },
  { icon: Recycle, label: 'Videi draudzīgs', sub: '85% pārstrādes rādītājs' },
];

export default function DashboardOrderPage() {
  const { token } = useAuth();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
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

      {/* Wizard — receives auth token so the order is linked to this user */}
      <OrderWizard token={token ?? undefined} />
    </div>
  );
}
