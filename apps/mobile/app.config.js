/**
 * Dynamic Expo config to centralize Google Maps key wiring.
 * Reads from a single env key and applies it to both iOS and Android map config.
 */
const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo;
  // Generic key first (unrestricted, safe for HTTP API calls).
  // Falls back to platform-specific keys so dev still works in Expo Go.
  // For iOS build: prefer iOS-restricted key; for Android: prefer Android-restricted key.
  // Since app.config.js runs server-side (no Platform.OS), we inject both platform
  // keys into their respective native config blocks below.
  const genericKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    '';
  const iosKey = genericKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || '';
  const androidKey = genericKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || '';
  // extra.googleMapsApiKey is read by the runtime helper — use whichever is available
  const googleMapsKey = genericKey || iosKey || androidKey;

  return {
    ...base,
    ios: {
      ...base.ios,
      config: {
        ...(base.ios?.config || {}),
        googleMapsApiKey: iosKey,
      },
    },
    android: {
      ...base.android,
      config: {
        ...(base.android?.config || {}),
        googleMaps: {
          ...(base.android?.config?.googleMaps || {}),
          apiKey: androidKey,
        },
      },
    },
    extra: {
      ...(base.extra || {}),
      googleMapsApiKey: googleMapsKey,
    },
  };
};
