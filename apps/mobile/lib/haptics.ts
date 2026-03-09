/**
 * Haptic feedback utility — wraps expo-haptics with a try/catch guard
 * so the app works in Expo Go (where the native module may be unavailable).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Haptics: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _Haptics = require('expo-haptics');
} catch {
  // Expo Go or native module not linked — haptics silently disabled
}

export const haptics = {
  /** Light tap — chip selection, filter toggle, navigation */
  light: () => {
    try {
      _Haptics?.impactAsync(_Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },

  /** Medium tap — primary button press, card tap */
  medium: () => {
    try {
      _Haptics?.impactAsync(_Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },

  /** Heavy tap — destructive action confirmation */
  heavy: () => {
    try {
      _Haptics?.impactAsync(_Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  },

  /** Success pulse — order placed, job accepted, login success */
  success: () => {
    try {
      _Haptics?.notificationAsync(_Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  /** Error buzz — API failure, validation error */
  error: () => {
    try {
      _Haptics?.notificationAsync(_Haptics.NotificationFeedbackType.Error);
    } catch {}
  },

  /** Warning — incomplete form, soft constraint */
  warning: () => {
    try {
      _Haptics?.notificationAsync(_Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },

  /** Subtle click — list item selection, step change */
  selection: () => {
    try {
      _Haptics?.selectionAsync();
    } catch {}
  },
};
