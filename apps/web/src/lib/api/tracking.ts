/**
 * Public tracking API — no authentication required.
 * Wraps GET /api/v1/track/:token
 */
import { API_URL } from './common';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrackingTransportJob {
  id: string;
  jobNumber: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  estimatedArrival: string | null;
  currentLocation: { lat: number; lng: number } | null;
  statusTimestamps: Record<string, string> | null;
  truckIndex: number | null;
  carrier: { name: string } | null;
  driver: { firstName: string } | null;
}

export interface TrackingData {
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  deliveryWindow: string | null;
  createdAt: string;
  items: Array<{
    quantity: number;
    unit: string;
    material: { name: string; category: string };
  }>;
  transportJobs: TrackingTransportJob[];
}

// ─── API call ────────────────────────────────────────────────────────────────

export async function fetchTrackingData(token: string): Promise<TrackingData> {
  const res = await fetch(`${API_URL}/track/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error('not_found');
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json() as Promise<TrackingData>;
}

// ─── Update delivery details (public share link) ─────────────────────────────

export interface UpdateDeliveryPayload {
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPostal?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export async function updateDeliveryDetails(
  token: string,
  payload: UpdateDeliveryPayload,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/track/${encodeURIComponent(token)}/delivery`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    if (res.status === 400) throw new Error('bad_request');
    if (res.status === 404) throw new Error('not_found');
    throw new Error(`HTTP ${res.status}`);
  }
}
