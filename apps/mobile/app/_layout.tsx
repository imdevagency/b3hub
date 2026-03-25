/**
 * Expo root layout.
 * Sets up the Navigation stack, AuthProvider, and global font loading.
 * Entry point for all mobile screens.
 */
import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth-context';
import { ModeProvider } from '@/lib/mode-context';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SCREEN } from '@/lib/transitions';
import React, { useEffect, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
// Guard: same JSI version-mismatch issue as in App.tsx
let GestureHandlerRootView: React.ComponentType<{ style?: object; children?: React.ReactNode }> =
  View as unknown as React.ComponentType<{ style?: object; children?: React.ReactNode }>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
} catch {
  /* Expo Go fallback — plain View used instead */
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

export default function RootLayout() {
  const notifListener = useRef<{ remove(): void } | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Apply Inter globally as soon as fonts are ready
  useEffect(() => {
    if (!fontsLoaded) return;
    // Set default fontFamily on all Text / TextInput elements
    (Text as any).defaultProps = (Text as any).defaultProps ?? {};
    (Text as any).defaultProps.style = { fontFamily: 'Inter_400Regular' };
    (TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
    (TextInput as any).defaultProps.style = { fontFamily: 'Inter_400Regular' };
  }, [fontsLoaded]);

  useEffect(() => {
    // Foreground notification received listener
    try {
      notifListener.current =
        _Notifications?.addNotificationReceivedListener(() => {
          // Badge / state updates can be wired here if needed
        }) ?? null;
    } catch {
      /* Expo Go */
    }
    return () => notifListener.current?.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <ModeProvider>
              <ToastProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    ...SCREEN.push,
                  }}
                >
                  {/* Booking wizard flows enter from the bottom — Uber-style */}
                  <Stack.Screen name="order-request-new" options={SCREEN.modal} />
                  <Stack.Screen name="order" options={SCREEN.modal} />
                  <Stack.Screen name="disposal" options={SCREEN.modal} />
                  <Stack.Screen name="transport" options={SCREEN.modal} />
                  {/* Auth redirect — instant, no animation */}
                  <Stack.Screen name="(auth)" options={SCREEN.fade} />
                </Stack>
              </ToastProvider>
            </ModeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
