/**
 * Equipment rental order from a specific provider listing
 * /order/equipment/listing/[id]
 *
 * Fetches the listing server-side to validate it exists and pre-fills the wizard
 * with the real provider's service type and price.
 */

import { notFound } from 'next/navigation';
import { ListingDetailClient } from '@/components/catalog/ListingDetailClient';
import { EQUIPMENT_SERVICES } from '@/lib/equipment-services';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchListing(id: string) {
  try {
    const res = await fetch(`${API_BASE}/rentals/listings/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export default async function EquipmentListingOrderPage({ params }: Props) {
  const { id } = await params;
  const listing = await fetchListing(id);

  if (!listing || !listing.isActive) {
    notFound();
  }

  const serviceConfig = EQUIPMENT_SERVICES.find((s) => s.type === listing.serviceType);

  return <ListingDetailClient listing={listing} serviceConfig={serviceConfig} />;
}
