/**
 * Generic equipment rental page — /order/equipment/[type]
 *
 * This implements the "Compare Offers" / Inverse Marketplace pattern.
 * The user provides dates and location, and the platform finds available listings.
 */

import { notFound } from 'next/navigation';
import { EquipmentMatchWizard } from '@/components/order/wizards/EquipmentMatchWizard';
import { EQUIPMENT_SERVICES } from '@/lib/equipment-services';
import type { RentalServiceType } from '@/lib/api/rentals';

type Props = { params: Promise<{ type: string }> };

export default async function EquipmentOrderPage({ params }: Props) {
  const { type } = await params;
  const typeUpper = type?.toUpperCase().replace(/-/g, '_') as RentalServiceType;

  const svc = EQUIPMENT_SERVICES.find((s) => s.type === typeUpper);
  if (!svc) notFound();

  return <EquipmentMatchWizard initialServiceType={typeUpper} />;
}
