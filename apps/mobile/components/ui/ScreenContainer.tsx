/**
 * ScreenContainer — universal page wrapper for consistent safe-area,
 * background color, and vertical layout across all screens.
 *
 * Animates in with a subtle fade + upward slide on mount (RN Animated).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Override background. Defaults to '#f2f2f7' (iOS system grouped gray) */
  bg?: string;
  /** Pass true for screens NOT inside a tab navigator (adds top safe area inset) */
  standalone?: boolean;
  style?: ViewStyle;
  /** Disable enter animation (e.g. for screens that animate themselves) */
  noAnimation?: boolean;
}

export function ScreenContainer({
  children,
  bg = '#f2f2f7',
  standalone = false,
  style,
  noAnimation = false,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const opacity = useRef(new Animated.Value(noAnimation ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(noAnimation ? 0 : 10)).current;

  useEffect(() => {
    if (noAnimation) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: bg },
        standalone && { paddingTop: insets.top },
        { opacity, transform: [{ translateY }] },
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

