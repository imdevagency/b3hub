/**
 * transitions.ts
 *
 * Single source of truth for all screen and within-screen animation config.
 *
 * Screen-level transitions (Expo Router / react-native-screens):
 *   import { SCREEN, MODAL, WIZARD } from '@/lib/transitions';
 *   <Stack.Screen options={SCREEN.push} />
 *
 * Within-screen Reanimated entrance animations:
 *   import { entering } from '@/lib/transitions';
 *   <Animated.View entering={entering.fadeSlideUp()} />
 *
 * Spring constants for programmatic Reanimated animations:
 *   import { spring } from '@/lib/transitions';
 *   translateY.value = withSpring(0, spring.standard);
 */

import { Platform } from 'react-native';
import {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  SlideInDown,
  ZoomIn,
  type EntryExitAnimationFunction,
  type EntryAnimationsValues,
} from 'react-native-reanimated';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// ─── Timing ───────────────────────────────────────────────────────────────────

/** Duration constants. All times in ms. */
export const DURATION = {
  /** Normal push / pop navigation */
  push: Platform.OS === 'ios' ? undefined : 280,
  /** Bottom-sheet / wizard modal entrance */
  modal: 360,
  /** Fast fade (tab-to-tab, inline content) */
  fast: 160,
  /** Stagger step between list items */
  stagger: 60,
} as const;

// ─── Spring configs ────────────────────────────────────────────────────────────

/** Pass to `withSpring()` for programmatic Reanimated animations. */
export const spring = {
  /** Standard interactive spring — cards, buttons, map markers. */
  standard: { damping: 18, stiffness: 180, mass: 0.6 },
  /** Snappy spring — fast confirm taps, badge bounces. */
  snappy:   { damping: 22, stiffness: 260, mass: 0.5 },
  /** Slow, weighty spring — bottom sheets expanding. */
  gentle:   { damping: 28, stiffness: 120, mass: 1.0 },
} as const;

// ─── Screen-level transition presets ─────────────────────────────────────────
//
// Use these as `screenOptions` or in a `<Stack.Screen options={...} />`.
// On iOS the `animation: 'slide_from_right'` already uses the native UIKit
// spring so it's intentionally not overridden.
// On Android we set `animationDuration` so it matches the iOS feel.

type StackScreenOptions = NativeStackNavigationOptions;

/** Standard push — used for detail screens, lists → detail, settings. */
const push: StackScreenOptions = {
  animation: 'slide_from_right',
  animationDuration: DURATION.push,
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
  animationMatchesGesture: false,
};

/**
 * Modal / wizard — slides in from the right, same feel as a push.
 * Gestures disabled — accidental swipe-back mid-wizard would lose form state.
 */
const modal: StackScreenOptions = {
  animation: 'slide_from_right',
  animationDuration: DURATION.push,
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
  animationMatchesGesture: false,
};

/** Fade-only — used for auth screens, splash-to-app handoff. */
const fade: StackScreenOptions = {
  animation: 'fade',
  animationDuration: DURATION.fast,
  gestureEnabled: false,
};

/** No animation — instant replace (e.g. redirect after login). */
const none: StackScreenOptions = {
  animation: 'none',
  gestureEnabled: false,
};

/** Exported Expo Router `Stack.Screen` option presets. */
export const SCREEN = { push, modal, fade, none } as const;

// ─── Reanimated within-screen entering animations ─────────────────────────────
//
// Use on `<Animated.View entering={entering.fadeSlideUp()}>` inside screens.
// The delay / duration tweaks are pre-applied so callers just pass the index.

type ReanimatedEntering = EntryExitAnimationFunction | EntryAnimationsValues;

/** Staggered entrance: item at position `index` is delayed by `index × stagger`. */
function staggered(
  base: { duration(ms: number): { delay(ms: number): ReturnType<typeof base.duration> } },
  index = 0,
  durationMs = 260,
) {
  return (base as any)
    .duration(durationMs)
    .delay(index * DURATION.stagger);
}

/**
 * Reanimated entering animation presets.
 *
 * @example
 * // Page content entrance
 * <Animated.View entering={entering.fadeSlideUp()}>
 *
 * // Staggered list card (index 0, 1, 2…)
 * <Animated.View entering={entering.card(index)}>
 *
 * // Overlay / modal backdrop
 * <Animated.View entering={entering.fade()}>
 */
export const entering = {
  /** Content fades in and moves up 12 px — default for page sections. */
  fadeSlideUp: (index = 0) =>
    FadeInUp.duration(260).delay(index * DURATION.stagger).springify().damping(18),

  /** Content fades in and moves down — for dropdowns, toasts. */
  fadeSlideDown: (index = 0) =>
    FadeInDown.duration(240).delay(index * DURATION.stagger).springify().damping(18),

  /** Slides in from right — mirrors the push screen transition for inner panels. */
  slideRight: (index = 0) =>
    SlideInRight.duration(260).delay(index * DURATION.stagger).springify().damping(18),

  /** Plain fade — overlays, dialogs, page skeletons. */
  fade: (delayMs = 0) => FadeIn.duration(DURATION.fast).delay(delayMs),

  /** Slides up from off-screen — modals, bottom sheets inner content. */
  slideUp: (delayMs = 80) =>
    SlideInDown.duration(DURATION.modal).delay(delayMs).springify().damping(spring.gentle.damping),

  /** Card stagger — feed/list cards that appear in sequence. */
  card: (index = 0) =>
    FadeInUp.duration(280).delay(index * DURATION.stagger).springify().damping(20),

  /** Subtle scale+fade — avatar, badge. */
  pop: (delayMs = 0) => ZoomIn.duration(200).delay(delayMs).springify().damping(16),
} as const;
