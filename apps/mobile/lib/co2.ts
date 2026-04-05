/**
 * CO2 emission estimate for heavy goods vehicle transport.
 * Emission factor: ~0.12 kg CO2e per tonne-km (EU HGV average, full load).
 * Reference: HBEFA 4.1 / EcoTransIT methodology.
 */
const HGV_CO2_KG_PER_TONNE_KM = 0.12;

/**
 * Estimate CO2 emissions in kilograms.
 * Returns null if either input is unavailable.
 */
export function estimateCo2Kg(
  distanceKm: number | null | undefined,
  weightTonnes: number | null | undefined,
): number | null {
  if (distanceKm == null || weightTonnes == null || distanceKm <= 0 || weightTonnes <= 0) {
    return null;
  }
  return Math.round(distanceKm * weightTonnes * HGV_CO2_KG_PER_TONNE_KM);
}

/**
 * Format as a short display string: e.g. "14 kg CO₂" or "1.2 t CO₂".
 */
export function formatCo2(co2Kg: number): string {
  if (co2Kg >= 1000) {
    return `${(co2Kg / 1000).toFixed(1)} t CO₂`;
  }
  return `${co2Kg} kg CO₂`;
}
