/**
 * ScreenContainer — universal page wrapper for consistent safe-area,
 * background color, and vertical layout across all screens.
 */

import React, { useRef, useCallback } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Override background. Defaults to '#ffffff' (white) */
  bg?: string;
  /**
   * Background colour for the status-bar inset strip only.
   * When provided and resolvedTopInset > 0, a separate thin View is rendered
   * at the top with this colour so the content area can have a different bg.
   * E.g. pass '#111827' for standalone ScreenHeader screens.
   */
  topBg?: string;
  /** Pass true for screens NOT inside a tab navigator (adds top safe area inset) */
  standalone?: boolean;
  /**
   * Override the top safe-area inset.
   * Pass 0 when the screen manages its own top spacing (e.g. auth screens with custom headers).
   */
  topInset?: number;
  style?: ViewStyle;
  /** Disable enter animation (e.g. for screens that animate themselves) */
  noAnimation?: boolean;
}

export function ScreenContainer({
  children,
  bg = '#ffffff',
  topBg,
  standalone = false,
  topInset,
  style,
  noAnimation = false,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  // Tab screens sit below TopBar which owns the top inset; standalone screens own it themselves.
  const resolvedTopInset = topInset !== undefined ? topInset : standalone ? insets.top : 0;

  const opacity = useRef(new Animated.Value(noAnimation ? 1 : 0)).current;

  // Simple fade-in on focus — no spring, no bounce.
  useFocusEffect(
    useCallback(() => {
      if (noAnimation) return;
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }, [noAnimation]),
  );

  // When topBg is provided, render a separate strip for the status-bar area
  // so the content background can differ from the header background.
  if (topBg && resolvedTopInset > 0) {
    return (
      <Animated.View style={[styles.base, { backgroundColor: topBg }, { opacity }, style]}>
        <View style={{ height: resolvedTopInset, backgroundColor: topBg }} />
        <View style={[styles.base, { backgroundColor: bg }]}>{children}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: bg },
        resolvedTopInset > 0 && { paddingTop: resolvedTopInset },
        { opacity },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
