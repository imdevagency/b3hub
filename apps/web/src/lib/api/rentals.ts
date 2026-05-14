/**
 * Equipment Rental API — marketplace rental orders + listings.
 * POST /rentals           — OptionalJwtAuthGuard, works without a token.
 * GET  /rentals/listings  — public browse.
 * POST /rentals/listings  — provider only (canRent).
 */
import { apiFetch } from './common';

export type RentalServiceType =
  | 'MINI_EXCAVATOR'
  | 'EXCAVATOR'
  | 'DUMPER'
  | 'COMPACTOR'
  | 'TELEHANDLER'
  | 'AERIAL_PLATFORM'
  | 'SCAFFOLDING'
  | 'TEMP_FENCING'
  | 'SITE_OFFICE'
  | 'GENERATOR'
  | 'LIGHTING_TOWER'
  | 'WATER_BOWSER'
  | 'AIR_COMPRESSOR'
  | 'POWER_TOOLS'
  | 'WELDER'
  | 'HEATER'
  | 'CONCRETE_EQUIPMENT'
  | 'REBAR_EQUIPMENT'
  | 'ALUMINUM_TOWER';

// ── Listing types ─────────────────────────────────────────────────────────────

export interface RentalListingProvider {
  id: string;
  name: string;
  logo: string | null;
  rating: number | null;
  verified: boolean;
  city?: string;
}

export interface AddOnDef {
  id: string;
  name: string;
  description?: string;
  pricePerDay?: number;
  priceFlat?: number;
  category: 'ACCESSORY' | 'OPERATOR' | 'TRANSPORT' | 'FUEL' | 'OTHER';
  minQty: number;
  maxQty: number;
}

export interface InsuranceDef {
  id: string;
  name: string;
  description: string;
  pricePerDay: number;
  excess: number;
  coversTheft: boolean;
  coversThirdParty: boolean;
  isRequired?: boolean;
}

export interface DocumentUrls {
  ce?: string;
  inspection?: string;
  manual?: string;
}

export interface RequiredDocuments {
  licenseType?: string;
  ownInsuranceRequired?: boolean;
  siteInductionRequired?: boolean;
}

export interface RentalListing {
  id: string;
  providerId: string;
  provider?: RentalListingProvider;
  serviceType: RentalServiceType;
  name: string;
  subCategoryLabel: string | null;
  productCode: string | null;
  description: string | null;
  unitLabel: string;
  yearOfManufacture: number | null;
  // Pricing
  pricePerDay: number;
  currency: string;
  vatRate: number;
  // Hire period
  minHireDays: number;
  maxHireDays: number | null;
  hirePeriodOptions: { days: number; label: string }[];
  // Fleet
  quantityTotal: number;
  // Coverage
  coverageCities: string[];
  deliveryRadiusKm: number | null;
  freeDeliveryRadiusKm: number | null;
  deliveryFeePerKm: number | null;
  providerLat: number | null;
  providerLng: number | null;
  selfCollectAvailable: boolean;
  selfCollectAddress: string | null;
  selfCollectLat: number | null;
  selfCollectLng: number | null;
  // Availability
  blockedDates: string[];
  // Media
  imageUrls: string[];
  documentUrls: DocumentUrls | null;
  // Technical specs
  specs: Record<string, unknown> | null;
  // Add-ons & insurance
  addOns: AddOnDef[] | null;
  insuranceOptions: InsuranceDef[] | null;
  insuranceRequired: boolean;
  // Policies
  depositAmount: number | null;
  depositMethod: string | null;
  fuelPolicy: string | null;
  cancellationPolicy: string | null;
  lateReturnFeePerDay: number | null;
  requiredDocuments: RequiredDocuments | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalListingPayload {
  serviceType: RentalServiceType;
  name: string;
  subCategoryLabel?: string;
  productCode?: string;
  description?: string;
  unitLabel?: string;
  yearOfManufacture?: number;
  pricePerDay: number;
  vatRate?: number;
  minHireDays?: number;
  maxHireDays?: number;
  hirePeriodOptions?: { days: number; label: string }[];
  quantityTotal: number;
  coverageCities?: string[];
  deliveryRadiusKm?: number;
  freeDeliveryRadiusKm?: number;
  deliveryFeePerKm?: number;
  providerLat?: number;
  providerLng?: number;
  selfCollectAvailable?: boolean;
  selfCollectAddress?: string;
  selfCollectLat?: number;
  selfCollectLng?: number;
  blockedDates?: string[];
  imageUrls?: string[];
  documentUrls?: DocumentUrls;
  specs?: Record<string, unknown>;
  addOns?: AddOnDef[];
  insuranceOptions?: InsuranceDef[];
  insuranceRequired?: boolean;
  depositAmount?: number;
  depositMethod?: string;
  fuelPolicy?: string;
  cancellationPolicy?: string;
  lateReturnFeePerDay?: number;
  requiredDocuments?: RequiredDocuments;
  isActive?: boolean;
}

export type UpdateRentalListingPayload = Partial<CreateRentalListingPayload>;

export interface ListingAvailability {
  blockedDates: string[]; // "YYYY-MM-DD" array
}

export interface RadiusCheckResult {
  withinRadius: boolean;
  distanceKm: number | null;
  maxRadiusKm?: number;
}

export async function getRentalListingAvailability(id: string): Promise<ListingAvailability> {
  return apiFetch<ListingAvailability>(`/rentals/listings/${id}/availability`);
}

export async function checkRentalListingRadius(
  id: string,
  lat: number,
  lng: number,
): Promise<RadiusCheckResult> {
  return apiFetch<RadiusCheckResult>(
    `/rentals/listings/${id}/radius-check?lat=${lat}&lng=${lng}`,
  );
}

export async function setListingBlockedDates(
  id: string,
  dates: string[],
  token: string,
): Promise<{ id: string; blockedDates: string[] }> {
  return apiFetch(`/rentals/listings/${id}/blocked-dates`, {
    method: 'PATCH',
    body: JSON.stringify({ dates }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Price estimate ────────────────────────────────────────────────────────────

export interface PriceEstimateInput {
  hireDays: number;
  selectedAddOnIds?: string[];
  insurancePlanId?: string;
  lat?: number;
  lng?: number;
}

export interface PriceEstimateResult {
  hireDays: number;
  vatRate: number;
  baseCost: number;
  addOnLines: { id: string; name: string; qty: number; pricePerDay?: number; priceFlat?: number; lineTotal: number }[];
  addOnTotal: number;
  insurance: { id: string; name: string; pricePerDay: number; total: number } | null;
  deliveryFee: number;
  depositAmount: number | null;
  depositMethod: string | null;
  priceExclVat: number;
  vatAmount: number;
  priceTotalInclVat: number;
  currency: string;
}

export async function getRentalPriceEstimate(
  id: string,
  input: PriceEstimateInput,
): Promise<PriceEstimateResult> {
  return apiFetch<PriceEstimateResult>(`/rentals/listings/${id}/price-estimate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getRentalListings(
  serviceType?: RentalServiceType,
  city?: string,
  lat?: number,
  lng?: number,
): Promise<RentalListing[]> {
  const params = new URLSearchParams();
  if (serviceType) params.set('serviceType', serviceType);
  if (city) params.set('city', city);
  if (lat !== undefined) params.set('lat', lat.toString());
  if (lng !== undefined) params.set('lng', lng.toString());
  const qs = params.toString();
  return apiFetch<RentalListing[]>(`/rentals/listings${qs ? `?${qs}` : ''}`);
}

export async function getRentalListing(id: string): Promise<RentalListing> {
  return apiFetch<RentalListing>(`/rentals/listings/${id}`);
}

export async function getMyRentalListings(token: string): Promise<RentalListing[]> {
  return apiFetch<RentalListing[]>('/rentals/listings/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createRentalListing(
  payload: CreateRentalListingPayload,
  token: string,
): Promise<RentalListing> {
  return apiFetch<RentalListing>('/rentals/listings', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateRentalListing(
  id: string,
  payload: UpdateRentalListingPayload,
  token: string,
): Promise<RentalListing> {
  return apiFetch<RentalListing>(`/rentals/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteRentalListing(id: string, token: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/rentals/listings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Order types ───────────────────────────────────────────────────────────────

export interface CreateRentalOrderPayload {
  listingId?: string;
  serviceType: RentalServiceType;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string;
  quantity: number;
  price: number;
  paymentMethod?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  // Add-ons & insurance
  selectedAddOns?: { id: string; name: string; pricePerDay?: number; priceFlat?: number; qty: number; lineTotal: number }[];
  insurancePlanId?: string;
  insurancePlanName?: string;
  insurancePricePerDay?: number;
  // Pricing breakdown
  deliveryFee?: number;
  depositAmount?: number;
}

export interface RentalOrderResult {
  id: string;
  orderNumber: string;
  status: string;
  price: number;
  currency: string;
  payseraPaymentUrl?: string | null;
}

export interface RentalOrderAdminRow {
  id: string;
  orderNumber: string;
  serviceType: RentalServiceType;
  address: string;
  city: string;
  hireDays: number;
  deliveryDate: string;
  quantity: number;
  price: number;
  currency: string;
  status: string;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt: string;
  provider?: { id: string; name: string } | null;
}

export async function getAllRentalOrders(
  token: string,
  serviceType?: RentalServiceType,
  status?: string,
): Promise<RentalOrderAdminRow[]> {
  const params = new URLSearchParams();
  if (serviceType) params.set('serviceType', serviceType);
  if (status) params.set('status', status);
  const qs = params.toString();
  return apiFetch<RentalOrderAdminRow[]>(`/rentals/all${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getProviderRentalOrders(
  token: string,
  serviceType?: RentalServiceType,
): Promise<RentalOrderAdminRow[]> {
  const qs = serviceType ? `?serviceType=${serviceType}` : '';
  return apiFetch<RentalOrderAdminRow[]>(`/rentals/provider${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createRentalOrder(
  payload: CreateRentalOrderPayload,
  token?: string,
): Promise<RentalOrderResult> {
  return apiFetch<RentalOrderResult>('/rentals', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

// ── Public catalogue ───────────────────────────────────────────────────────────

export interface RentalServiceDef {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  group: string | null;
  basePrice: number | null;
  priceUnit: string | null;
  currency: string;
  sortOrder: number;
}

/** Fetches active rental service type definitions from the live catalogue. */
export async function fetchRentalServiceTypes(): Promise<RentalServiceDef[]> {
  try {
    return await apiFetch<RentalServiceDef[]>('/catalogue/rental-service-types');
  } catch {
    return [];
  }
}

// ── Material catalogue (public, no auth) ──────────────────────────────────

export interface MaterialCategoryDef {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  densityTM3: number | null;
  defaultUnit: string;
  sortOrder: number;
}

export interface MaterialFractionDef {
  id: string;
  code: string;
  category: string;
  label: string;
  labelLv: string | null;
  sortOrder: number;
}

export async function fetchMaterialCategoryDefs(): Promise<MaterialCategoryDef[]> {
  try {
    return await apiFetch<MaterialCategoryDef[]>('/catalogue/material-categories');
  } catch {
    return [];
  }
}

export async function fetchMaterialFractionDefs(): Promise<MaterialFractionDef[]> {
  try {
    return await apiFetch<MaterialFractionDef[]>('/catalogue/material-fractions');
  } catch {
    return [];
  }
}
