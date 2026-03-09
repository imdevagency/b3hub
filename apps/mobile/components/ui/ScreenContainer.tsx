/**
 * ScreenContainer — universal page wrapper for consistent safe-area,
 * background color, and vertical layout across all screens.
 *
 * Tab screens (inside SellerLayout / BuyerLayout / DriverLayout):
 *   The tab _layout.tsx already handles <SafeAreaView edges={['top']}>.
 *   These screens should use ScreenContainer WITHOUT standalone so no
 *   double top-inset is applied.
 *
 * Standalone screens (notifications, delivery-proof, tour-planner, etc.):
 *   Must handle their own top inset. Pass standalone={true} so
 *   ScreenContainer adds the safe area padding itself.
 *
 * Usage:
 *   <ScreenContainer>          ← inside a tab
 *   <ScreenContainer standalone> ← fullscreen / stack pushed screen
 *   <ScreenContainer bg="#fff">  ← white background variant
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Override background. Defaults to '#f2f2f7' (iOS system grouped gray) */
  bg?: string;
  /** Pass true for screens NOT inside a tab navigator (adds top safe area inset) */
  standalone?: boolean;
  style?: ViewStyle;
}

export function ScreenContainer({
  children,
  bg = '#f2f2f7',
  standalone = false,
  style,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg },
        standalone && { paddingTop: insets.top },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
