/**
 * rentals.ts — API functions for generic rental services.
 *
 * Covers: SCAFFOLDING, TEMP_FENCING, SITE_OFFICE, GENERATOR,
 *         LIGHTING_TOWER, WATER_BOWSER (and future service types).
 *
 * SkipHireOrder and ToiletCabinOrder have their own API files.
 */

import { apiFetch } from './common';
import type { RentalServiceType } from '../rental-services';

// ── Listing types ─────────────────────────────────────────────────

export interface RentalListingProvider {
  id: string;
  name: string;
  logo: string | null;
  rating: number | null;
  verified: boolean;
}

export interface RentalListing {
  id: string;
  providerId: string;
  provider?: RentalListingProvider;
  serviceType: RentalServiceType;
  name: string;
  description: string | null;
  unitLabel: string;
  pricePerDay: number;
  currency: string;
  vatRate: number;
  minHireDays: number;
  maxHireDays: number | null;
  hirePeriodOptions: { days: number; label: string }[];
  quantityTotal: number;
  coverageCities: string[];
  deliveryRadiusKm: number | null;
  deliveryFeePerKm: number | null;
  imageUrls: string[];
  specs: Record<string, string> | null;
  isActive: boolean;
}

// ── Types ─────────────────────────────────────────────────────────

export type RentalOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'CARD' | 'INVOICE' | 'SEPA';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'PAID' | 'FAILED';

export interface RentalOrder {
  id: string;
  orderNumber: string;
  serviceType: RentalServiceType;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string | null;
  quantity: number;
  price: number;
  currency: string;
  paymentMethod: PaymentMethod;
  payseraOrderId?: string | null;
  payseraPaymentUrl?: string | null;
  paymentStatus: PaymentStatus;
  status: RentalOrderStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  userId?: string | null;
  carrierId?: string | null;
  currentLocation?: { lat: number; lng: number; updatedAt: string } | null;
  trackingToken?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  statusTimestamps?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalOrderPayload {
  serviceType: RentalServiceType;
  listingId?: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string;
  quantity: number;
  price: number;
  paymentMethod?: PaymentMethod;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ── API functions ─────────────────────────────────────────────────

export const rentalsApi = {
  /** Public — browse active listings for a service type, optionally filtered by city */
  findListings: (
    serviceType: RentalServiceType,
    city?: string,
    lat?: number,
    lng?: number,
  ): Promise<RentalListing[]> => {
    const params = new URLSearchParams({ serviceType });
    if (city) params.set('city', city.toLowerCase());
    if (lat !== undefined) params.set('lat', String(lat));
    if (lng !== undefined) params.set('lng', String(lng));
    return apiFetch(`/rentals/listings?${params.toString()}`, {});
  },

  /** Create a new rental order (works for guests too — token optional) */
  create: (payload: CreateRentalOrderPayload, token?: string | null): Promise<RentalOrder> =>
    apiFetch('/rentals', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    }),

  /** Buyer: list own rental orders, optionally filtered by serviceType */
  myOrders: (token: string, serviceType?: RentalServiceType): Promise<RentalOrder[]> =>
    apiFetch(`/rentals/my${serviceType ? `?serviceType=${serviceType}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),

  /** Carrier/driver: list assigned rental orders */
  carrierOrders: (token: string, serviceType?: RentalServiceType): Promise<RentalOrder[]> =>
    apiFetch(`/rentals/carrier${serviceType ? `?serviceType=${serviceType}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }),

  /** Public tracking by token — no auth required */
  track: (trackingToken: string): Promise<RentalOrder> =>
    apiFetch(`/rentals/track/${trackingToken}`, {}),

  /** Get one order */
  findOne: (id: string, token: string): Promise<RentalOrder> =>
    apiFetch(`/rentals/${id}`, { headers: { Authorization: `Bearer ${token}` } }),

  /** Carrier: update order status */
  updateStatus: (id: string, status: RentalOrderStatus, token: string): Promise<RentalOrder> =>
    apiFetch(`/rentals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: { Authorization: `Bearer ${token}` },
    }),
};
