/**
 * ScreenContainer — universal page wrapper for consistent safe-area,
 * background color, and vertical layout across all screens.
 *
 * Animates in with a subtle fade + upward slide on mount (Reanimated).
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

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

  const opacity = useSharedValue(noAnimation ? 1 : 0);
  const translateY = useSharedValue(noAnimation ? 0 : 10);

  useEffect(() => {
    if (noAnimation) return;
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: bg },
        standalone && { paddingTop: insets.top },
        animStyle,
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

