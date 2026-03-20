/**
 * Centralized Google Maps key access for mobile.
 * Keeps env lookup in one place and supports a legacy alias.
 */
export function getGoogleMapsPublicKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
    ''
  );
}
