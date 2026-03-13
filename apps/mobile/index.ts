// react-native-gesture-handler MUST come first, guarded for Expo Go:
// RNGH 2.24.x calls install() via JSI on import; Expo Go ships a different native
// version which causes an uncatchable HostFunction exception on static import.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-gesture-handler');
} catch {
  /* Expo Go — version mismatch; built-in RNGH still works */
}

// Register background location task at the entry-point level (required by expo-task-manager).
// Guarded so Expo Go builds don't crash on the missing native module.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./lib/location-task');
} catch {
  /* Expo Go — task manager unavailable */
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
