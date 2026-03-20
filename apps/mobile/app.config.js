/**
 * Dynamic Expo config to centralize Google Maps key wiring.
 * Reads from a single env key and applies it to both iOS and Android map config.
 */
const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo;
  const googleMapsKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    '';

  return {
    ...base,
    ios: {
      ...base.ios,
      config: {
        ...(base.ios?.config || {}),
        googleMapsApiKey: googleMapsKey,
      },
    },
    android: {
      ...base.android,
      config: {
        ...(base.android?.config || {}),
        googleMaps: {
          ...(base.android?.config?.googleMaps || {}),
          apiKey: googleMapsKey,
        },
      },
    },
    extra: {
      ...(base.extra || {}),
      googleMapsApiKey: googleMapsKey,
    },
  };
};
