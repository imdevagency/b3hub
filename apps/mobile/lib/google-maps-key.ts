/**
 * Centralized Google Maps key access for mobile.
 * Priority:
 *  1. EXPO_PUBLIC_GOOGLE_MAPS_API_KEY  (unrestricted, best for HTTP API calls)
 *  2. app.config.js extra.googleMapsApiKey  (set from platform-specific keys at build time)
 *  3. Platform-specific env vars directly (last resort)
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function getGoogleMapsPublicKey(): string {
  // 1. Explicit generic key (no restrictions, ideal for Places/Geocoding HTTP calls)
  const generic =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
    '';
  if (generic) return generic;

  // 2. Key injected by app.config.js via extra (may be the platform-specific key)
  const fromConfig = (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.googleMapsApiKey ?? '';
  if (fromConfig) return fromConfig;

  // 3. Platform-specific env directly
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ?? '';
  }
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ?? '';
}
