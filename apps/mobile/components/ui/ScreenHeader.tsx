/**
 * ScreenHeader — shared back-navigation header used by standalone screens
 * (settings, notifications, order detail, etc.).
 *
 * Provides a consistent look that matches Uber's flat, minimal top bar:
 *   [← back]  Title text  [optional right action]
 *
 * Previously, settings.tsx and notifications.tsx each hand-rolled their own
 * headers with different heights, icon styles, and background colours. This
 * component unifies them.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '@/lib/theme';

interface ScreenHeaderProps {
  title: string;
  /**
   * Element rendered on the right side.
   * Can be an Icon button or a Text button.
   */
  rightAction?: React.ReactNode;
  /**
   * Override the default router.back() behaviour.
   * Pass explicit `null` to disable back button entirely.
   */
  onBack?: (() => void) | null;
  /**
   * Force showing the back button.
   * By default, it auto-shows if navigation.canGoBack() is true.
   */
  showBack?: boolean;
  /**
   * Remove the bottom border.
   */
  noBorder?: boolean;
}

export function ScreenHeader({
  title,
  rightAction,
  onBack,
  showBack,
  noBorder,
}: ScreenHeaderProps) {
  const router = useRouter();

  // If onBack is explicitly null, hide back button.
  // Otherwise, use canGoBack() or force showBack.
  const shouldShowBack = onBack !== null && (showBack || router.canGoBack());

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={[styles.header, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.left}>
        {shouldShowBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={8}
            activeOpacity={0.6}
            accessibilityLabel="Atpakaļ"
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {rightAction && <View style={styles.right}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
});
