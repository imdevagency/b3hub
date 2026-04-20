/**
 * Expo root layout — minimal, edge-to-edge, Uber-style.
 *
 * Responsibilities (only):
 *  1. Font loading (block render until ready)
 *  2. Native module guards (GestureHandler, Stripe, Sentry, Notifications, NetInfo)
 *  3. Single navigation Stack with screen-level transition presets
 *
 * All context providers live in lib/providers.tsx → <AppProviders>.
 */
import * as Sentry from '@sentry/react-native';
import '../global.css';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/lib/providers';
import { flushProofQueue } from '@/lib/proof-queue';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { SCREEN } from '@/lib/transitions';
import React, { useEffect, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import { colors } from '@/lib/theme';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// ── Gesture Handler: guard against JSI version mismatch in Expo Go ───────────
let GestureHandlerRootView: React.ComponentType<{ style?: object; children?: React.ReactNode }> =
  View as unknown as React.ComponentType<{ style?: object; children?: React.ReactNode }>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
} catch {
  /* Expo Go fallback */
}

// ── Push notifications: guarded — native module not present in Expo Go ────────
let _Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _Notifications = require('expo-notifications');
} catch {
  /* Expo Go */
}

// Show notifications as banners even when app is in foreground
try {
  _Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  /* ignore */
}

// ── NetInfo: guarded — used for offline proof-queue flush ────────────────────
let _NetInfo: typeof import('@react-native-community/netinfo') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _NetInfo = require('@react-native-community/netinfo');
} catch {
  /* Expo Go */
}

// ── Stripe: guarded — requires native build ───────────────────────────────────
let StripeProvider: React.ComponentType<{
  publishableKey: string;
  children?: React.ReactNode;
}> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch {
  /* Expo Go fallback */
}
const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// ── Sentry: init once at module level ────────────────────────────────────────
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.APP_VARIANT ?? 'production',
  tracesSampleRate: process.env.APP_VARIANT === 'development' ? 1.0 : 0.2,
  enabled: process.env.APP_VARIANT !== 'development',
});

// ── Navigation Stack options ──────────────────────────────────────────────────
// contentStyle enforces a unified background so cross-screen transitions never
// show a white flash — edge-to-edge, Uber-style.
const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bgCard },
  ...SCREEN.push,
} as const;

// Thin wrapper — conditionally adds StripeProvider without duplicating the Stack.
function MaybeStripe({ children }: { children: React.ReactNode }) {
  if (StripeProvider && STRIPE_PK) {
    return <StripeProvider publishableKey={STRIPE_PK}>{children}</StripeProvider>;
  }
  return <>{children}</>;
}

export default Sentry.wrap(function RootLayout() {
  const notifListener = useRef<{ remove(): void } | null>(null);
  const notifResponseListener = useRef<{ remove(): void } | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Set Inter as the global default synchronously — must NOT be in useEffect
  // because that fires after first render, causing a system-font flash.
  if (fontsLoaded) {
    (Text as any).defaultProps = (Text as any).defaultProps ?? {};
    (Text as any).defaultProps.style = { fontFamily: 'Inter_400Regular' };
    (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
    (TextInput as any).defaultProps.style = { fontFamily: 'Inter_400Regular' };
  }

  useEffect(() => {
    try {
      notifListener.current = _Notifications?.addNotificationReceivedListener(() => {}) ?? null;
    } catch {
      /* Expo Go */
    }
    return () => notifListener.current?.remove();
  }, []);

  // Route the user to the relevant screen when they tap a push notification.
  // The notification data payload must contain at least one of: orderId, jobId.
  useEffect(() => {
    try {
      notifResponseListener.current =
        _Notifications?.addNotificationResponseReceivedListener((response) => {
          const data = (response.notification.request.content.data ?? {}) as Record<string, string>;
          const type = data.type as string | undefined;

          if (data.orderId) {
            // Surcharge approval, order status changes, disputes → buyer order detail
            router.push(`/(buyer)/order/${data.orderId}`);
          } else if (data.jobId && type === 'JOB_ALERT') {
            // New job available → driver job board
            router.push('/(driver)/jobs');
          } else if (data.jobId) {
            // Transport job updates (surcharge approved/rejected, delay) → active job
            router.push('/(driver)/active');
          }
        }) ?? null;
    } catch {
      /* Expo Go */
    }
    return () => notifResponseListener.current?.remove();
  }, []);

  useEffect(() => {
    if (!_NetInfo) return;
    let wasOffline = false;
    const unsub = _NetInfo.default.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && wasOffline) flushProofQueue().catch(() => {});
      wasOffline = !online;
    });
    return () => unsub();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        {/* Translucent — UI bleeds under status bar, safe-area insets handle spacing */}
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <ErrorBoundary>
          <MaybeStripe>
            <Stack screenOptions={STACK_SCREEN_OPTIONS}>
              {/* Wizard flows — full-screen swipe-back, same as push (Uber-style) */}
              <Stack.Screen name="order-request-new" options={SCREEN.modal} />
              <Stack.Screen name="order" options={SCREEN.modal} />
              <Stack.Screen name="disposal" options={SCREEN.modal} />
              <Stack.Screen name="transport" options={SCREEN.modal} />
              {/* Auth — instant fade, no back gesture */}
              <Stack.Screen name="(auth)" options={SCREEN.fade} />
            </Stack>
          </MaybeStripe>
          {/* Offline overlay — rendered after Stack so navigation is initialised first */}
          <OfflineBanner />
        </ErrorBoundary>
      </AppProviders>
    </GestureHandlerRootView>
  );
});
