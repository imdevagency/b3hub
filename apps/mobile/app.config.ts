import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config.
 *
 * All secrets are read from environment variables so this file is safe to
 * commit.  In local dev, populate apps/mobile/.env.local.
 * In EAS builds, add them as EAS environment secrets.
 *
 * APP_VARIANT controls which build flavour is produced:
 *   development  → bundle ID lv.b3hub.app.dev,     name "B3Hub Dev"     (dev client)
 *   staging      → bundle ID lv.b3hub.app.staging,  name "B3Hub Staging" (preview/TestFlight internal)
 *   production   → bundle ID lv.b3hub.app,           name "B3Hub"         (App Store)
 *
 * Required for production builds:
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID — Android Maps SDK key (Android apps restriction)
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS     — iOS Maps SDK key (iOS apps restriction)
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY         — Fallback if platform-specific keys not set
 *   EXPO_PUBLIC_API_URL                     — Production backend URL
 *   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   EAS_PROJECT_ID                          — From `eas init`
 */

const APP_VARIANT = (process.env.APP_VARIANT ?? 'production') as
  | 'development'
  | 'staging'
  | 'production';

const variants = {
  development: {
    name: 'B3Hub Dev',
    bundleId: 'lv.b3hub.app.dev',
    androidPackage: 'lv.b3hub.app.dev',
  },
  staging: {
    name: 'B3Hub Staging',
    bundleId: 'lv.b3hub.app.staging',
    androidPackage: 'lv.b3hub.app.staging',
  },
  production: {
    name: 'B3Hub',
    bundleId: 'lv.b3hub.app',
    androidPackage: 'lv.b3hub.app',
  },
} as const;

const variant = variants[APP_VARIANT];

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsKeyAndroid =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
    '';

  const googleMapsKeyIos =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ??
    '';

  const easProjectId = process.env.EAS_PROJECT_ID ?? '';

  return {
    ...config,
    name: variant.name,
    slug: 'b3hub',
    scheme: 'b3hub',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    // runtimeVersion: sdkVersion for development so Expo Go recognises the runtime.
    // appVersion for production/staging so OTA updates are strictly versioned.
    runtimeVersion:
      APP_VARIANT === 'development'
        ? { policy: 'sdkVersion' }
        : { policy: 'appVersion' },
    updates: {
      url: easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined,
      enabled: APP_VARIANT !== 'development',
      fallbackToCacheTimeout: 0,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: variant.bundleId,
      config: {
        googleMapsApiKey: googleMapsKeyIos,
      },
      infoPlist: {
        // NOTE: Remove NSAllowsArbitraryLoads once the backend is on HTTPS.
        // It is needed only while testing against a non-TLS local server.
        // For production builds set EXPO_PUBLIC_API_URL to an https:// URL
        // and remove this entry.
        ...(process.env.NODE_ENV !== 'production' && {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
          },
        }),
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'B3Hub nepārtraukti izseko jūsu atrašanās vietu aktīvu piegāžu laikā, arī fonā.',
        NSLocationAlwaysUsageDescription:
          'B3Hub nepārtraukti izseko jūsu atrašanās vietu aktīvu piegāžu laikā, arī fonā.',
        NSLocationWhenInUseUsageDescription:
          'B3Hub izmanto jūsu atrašanās vietu navigācijai un piegāžu izsekošanai.',
        NSCameraUsageDescription:
          'B3Hub izmanto kameru, lai uzņemtu piegādes apstiprinājuma fotoattēlus.',
        NSPhotoLibraryUsageDescription:
          'B3Hub var piekļūt jūsu foto bibliotēkai, lai atlasītu piegādes pierādījuma attēlus.',
        UIBackgroundModes: ['location', 'fetch'],
        // Required for Linking.canOpenURL() to work with third-party navigation apps.
        // Without this, iOS always returns false and navigation falls back to web URLs.
        LSApplicationQueriesSchemes: ['waze', 'comgooglemaps', 'maps'],
      },
    },
    android: {
      package: variant.androidPackage,
      config: {
        googleMaps: {
          apiKey: googleMapsKeyAndroid,
        },
      },
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.POST_NOTIFICATIONS',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    experiments: {
      tsconfigPaths: true,
    },
    extra: {
      eas: {
        projectId: easProjectId || undefined,
      },
    },
    plugins: [
      'expo-router',
      'expo-updates',
      [
        '@stripe/stripe-react-native',
        {
          merchantIdentifier: 'merchant.lv.b3hub.app',
          enableGooglePay: false,
        },
      ],
      [
        'expo-notifications',
        {
          color: '#dc2626',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow B3Hub to access your location for real-time navigation and delivery tracking.',
          locationAlwaysAndWhenInUsePermission:
            'Allow B3Hub to access your location in the background to track active deliveries.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      'expo-task-manager',
      'expo-font',
    ],
  };
};
