/**
 * Background location task for driver tracking.
 *
 * This file MUST be imported at the app entry point (index.ts) so that
 * TaskManager.defineTask is called before the JS runtime suspends.
 *
 * The task reads the active job ID and JWT from AsyncStorage, then pushes
 * the GPS fix to the backend. It degrades silently in Expo Go (where the
 * native task-manager module is unavailable).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Guarded require for expo-secure-store (unavailable in Expo Go)
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch {
  // Expo Go — will fall back to AsyncStorage for token read
}

// Storage keys shared with auth-context and active.tsx
const TOKEN_KEY = 'b3hub_token';
export const ACTIVE_JOB_KEY = 'b3hub_active_job_id';
export const BG_LOCATION_TASK = 'bg-driver-location';

// Guarded require — expo-task-manager and expo-location require a custom build.
let TaskManager: typeof import('expo-task-manager') | null = null;
let Location: typeof import('expo-location') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Location = require('expo-location');
} catch {
  // Expo Go — background location unavailable
}

if (TaskManager && Location) {
  TaskManager.defineTask(
    BG_LOCATION_TASK,
    async ({ data, error }: {
      data?: { locations: { coords: { latitude: number; longitude: number } }[] };
      error: { message: string } | null;
    }) => {
    if (error) return;

    const locations: { coords: { latitude: number; longitude: number } }[] =
      data?.locations ?? [];
    if (locations.length === 0) return;

    const { latitude, longitude } = locations[locations.length - 1].coords;

    try {
      const [token, jobId] = await Promise.all([
        SecureStore
          ? SecureStore.getItemAsync(TOKEN_KEY)
          : AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(ACTIVE_JOB_KEY),
      ]);
      if (!token || !jobId) return;

      const apiUrl =
        process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

      await fetch(`${apiUrl}/transport-jobs/${jobId}/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });
    } catch {
      // Silent — never crash the background task
    }
  });
}

/** Start background (or foreground fallback) location updates. */
export async function startLocationTracking(jobId: string): Promise<void> {
  if (!TaskManager || !Location) return; // Expo Go — skip

  // Persist the active job ID so the background task can read it from AsyncStorage
  await AsyncStorage.setItem(ACTIVE_JOB_KEY, jobId);

  // Request foreground permission first (required before background)
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  // Try to get background permission — degrade gracefully if declined
  let hasBgPermission = false;
  try {
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    hasBgPermission = bg === 'granted';
  } catch {
    // Not all devices/configs support background permission prompt
  }

  // Stop any existing tracking before starting fresh
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {});
  }

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 10,          // update every 10 m
    timeInterval: 5_000,           // or every 5 s
    showsBackgroundLocationIndicator: hasBgPermission, // iOS blue bar when bg active
    // Android foreground service (shown when app is backgrounded)
    foregroundService: {
      notificationTitle: 'B3Hub — navigācija',
      notificationBody: 'Jūsu atrašanās vieta tiek pārsūtīta dispečeram.',
      notificationColor: '#2563EB',
    },
    pausesUpdatesAutomatically: false,
  });
}

/** Stop background location updates and clear the stored job ID. */
export async function stopLocationTracking(): Promise<void> {
  if (!Location) return;
  await AsyncStorage.removeItem(ACTIVE_JOB_KEY);
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {});
  }
}
