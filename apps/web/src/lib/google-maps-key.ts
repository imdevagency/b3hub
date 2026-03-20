/**
 * Centralized Google Maps public API key resolver for web.
 * Supports the canonical env var and a legacy fallback alias.
 */

export function getGoogleMapsPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ??
    ''
  );
}
