import { Linking } from 'react-native';

/**
 * Opens a Paysera payment URL in the native in-app browser sheet
 * (SFSafariViewController on iOS, Chrome Custom Tab on Android).
 *
 * Falls back to Linking.openURL if expo-web-browser native module is not
 * yet linked (e.g. Expo Go before cache clear, or CI).
 */
export async function openPaymentUrl(url: string): Promise<void> {
  try {
    // Dynamic import so the module error is caught at runtime, not at parse time.
    const WebBrowser = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}
