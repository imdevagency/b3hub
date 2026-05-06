import { API_URL } from './common';

export interface FuelRates {
  diesel: number;
  fuelMultiplier: number;
  truckLPer100km: number;
  source: string;
  updatedAt: string;
}

export async function fetchFuelRates(): Promise<FuelRates | null> {
  try {
    const res = await fetch(`${API_URL}/public/price-rates`);
    if (!res.ok) return null;
    return (await res.json()) as FuelRates;
  } catch {
    return null;
  }
}

export const fuelApi = { fetchFuelRates };
