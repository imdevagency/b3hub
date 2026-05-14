import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VehicleServiceCategory {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  eligibleVehicleTypes: string[];
  minCapacityT: number | null;
  maxCapacityT: number | null;
  fromPrice: number | null;
  pricePerKm: number | null;
  iconKey: string | null;
  sortOrder: number;
}

export interface ToiletCabinDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  basePrice: number | null;
  currency: string;
  sortOrder: number;
}

export interface RentalServiceDefinition {
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

export interface ScrapMaterialDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  indicativePricePerTonne: number | null;
  currency: string;
  selfTransportAllowed: boolean;
  sortOrder: number;
}

export interface MaterialCategoryDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  densityTM3: number | null;
  defaultUnit: string;
  iconKey: string | null;
  sortOrder: number;
}

export interface MaterialFractionDefinition {
  id: string;
  code: string;
  category: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  unit: string | null;
  sortOrder: number;
}

// ─── API functions ──────────────────────────────────────────────────────────

export async function fetchVehicleCategories(): Promise<VehicleServiceCategory[]> {
  return apiFetch<VehicleServiceCategory[]>('/catalogue/vehicle-categories');
}

export async function fetchToiletCabinTypes(): Promise<ToiletCabinDefinition[]> {
  return apiFetch<ToiletCabinDefinition[]>('/catalogue/toilet-cabin-types');
}

export async function fetchRentalServiceTypes(): Promise<RentalServiceDefinition[]> {
  return apiFetch<RentalServiceDefinition[]>('/catalogue/rental-service-types');
}

export async function fetchScrapMaterials(): Promise<ScrapMaterialDefinition[]> {
  return apiFetch<ScrapMaterialDefinition[]>('/catalogue/scrap-materials');
}

export async function fetchMaterialCategories(): Promise<MaterialCategoryDefinition[]> {
  return apiFetch<MaterialCategoryDefinition[]>('/catalogue/material-categories');
}

export async function fetchMaterialFractions(category?: string): Promise<MaterialFractionDefinition[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiFetch<MaterialFractionDefinition[]>(`/catalogue/material-fractions${qs}`);
}

export interface WasteTypeDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  description: string | null;
  descriptionLv: string | null;
  group: string;
  groupLabelLv: string | null;
  isHazardous: boolean;
  isBuyback: boolean;
  iconKey: string | null;
  sortOrder: number;
}

export async function fetchWasteTypes(group?: string): Promise<WasteTypeDefinition[]> {
  const qs = group ? `?group=${encodeURIComponent(group)}` : '';
  return apiFetch<WasteTypeDefinition[]>(`/catalogue/waste-types${qs}`);
}
