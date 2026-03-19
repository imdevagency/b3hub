/**
 * FadeInView
 *
 * Reusable Reanimated entrance animation wrapper.
 * Drop-in replacement for <View> whenever you want content to animate
 * in as a screen loads or a list populates.
 *
 * Uses spring physics so the motion feels physical, not tween-y.
 *
 * @example
 * // Page section — fades + slides up
 * <FadeInView>
 *   <InfoSection label="Details">...</InfoSection>
 * </FadeInView>
 *
 * // Staggered list cards (index 0, 1, 2…)
 * {items.map((item, i) => (
 *   <FadeInView key={item.id} index={i} variant="card">
 *     <OrderCard {...item} />
 *   </FadeInView>
 * ))}
 *
 * // Modal inner content
 * <FadeInView variant="slideUp" delay={80}>
 *   <ModalBody />
 * </FadeInView>
 */

import React from 'react';
import Animated from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';
import { entering as E } from '@/lib/transitions';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FadeInVariant =
  | 'fadeSlideUp'   // default — fades + rises 12 px; good for page sections
  | 'fadeSlideDown' // dropdowns, toasts, pull-down content
  | 'slideRight'    // mirrors push screen transition for inner panels
  | 'fade'          // plain fade — overlays, dialogs, skeletons
  | 'slideUp'       // slides up from off-screen — modal / bottom-sheet content
  | 'card'          // stagger-aware; use with index prop
  | 'pop';          // scale + fade — avatars, badges, icons

export interface FadeInViewProps {
  children: React.ReactNode;
  /**
   * Animation preset. Default: `'fadeSlideUp'`.
   */
  variant?: FadeInVariant;
  /**
   * Position in a staggered list. Each step delays by `transitions.DURATION.stagger` (60 ms).
   * Relevant for `'card'`, `'fadeSlideUp'`, `'fadeSlideDown'`, `'slideRight'`.
   */
  index?: number;
  /**
   * Explicit delay in ms. Overrides the index-based stagger for
   * `'fade'`, `'slideUp'`, `'pop'` variants.
   */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FadeInView({
  children,
  variant = 'fadeSlideUp',
  index = 0,
  delay = 0,
  style,
}: FadeInViewProps) {
  const animation = (() => {
    switch (variant) {
      case 'fadeSlideUp':   return E.fadeSlideUp(index);
      case 'fadeSlideDown': return E.fadeSlideDown(index);
      case 'slideRight':    return E.slideRight(index);
      case 'fade':          return E.fade(delay);
      case 'slideUp':       return E.slideUp(delay || 80);
      case 'card':          return E.card(index);
      case 'pop':           return E.pop(delay);
    }
  })();

  return (
    <Animated.View entering={animation} style={style}>
      {children}
    </Animated.View>
  );
}
