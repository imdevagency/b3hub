// react-native-gesture-handler MUST come first, guarded for Expo Go:
// RNGH 2.24.x calls install() via JSI on import; Expo Go ships a different native
// version which causes an uncatchable HostFunction exception on static import.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-gesture-handler');
} catch {
  /* Expo Go — version mismatch; built-in RNGH still works */
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');
