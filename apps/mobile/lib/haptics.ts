/**
 * Haptic feedback utility — wraps expo-haptics with runtime guards
 * so the app works in Expo Go (where the native module may be unavailable).
 */
import * as ExpoHaptics from 'expo-haptics';

export const haptics = {
  /** Light tap — chip selection, filter toggle, navigation */
  light: () => {
    ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => {});
  },

  /** Medium tap — primary button press, card tap */
  medium: () => {
    ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },

  /** Heavy tap — destructive action confirmation */
  heavy: () => {
    ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },

  /** Success pulse — order placed, job accepted, login success */
  success: () => {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => {});
  },

  /** Error buzz — API failure, validation error */
  error: () => {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error).catch(() => {});
  },

  /** Warning — incomplete form, soft constraint */
  warning: () => {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning).catch(() => {});
  },

  /** Subtle click — list item selection, step change */
  selection: () => {
    ExpoHaptics.selectionAsync().catch(() => {});
  },
};
