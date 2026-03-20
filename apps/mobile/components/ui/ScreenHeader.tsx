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
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

interface ScreenHeaderProps {
  title: string;
  /** Override the default router.back() behaviour */
  onBack?: () => void;
  /** Element rendered on the right side (e.g. mark-all button, edit icon) */
  rightSlot?: React.ReactNode;
  /** Extra style applied to the outer container */
  style?: ViewStyle;
  /**
   * When true the component adds the safe-area top inset as padding.
   * Use this when the parent ScreenContainer was given standalone=true
   * and does NOT add its own top inset (e.g. bg-white auth-adjacent screens).
   */
  withTopInset?: boolean;
}

export function ScreenHeader({
  title,
  onBack,
  rightSlot,
  style,
  withTopInset = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, withTopInset && { paddingTop: insets.top }, style]}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/(buyer)/home' as any))}
        hitSlop={10}
        activeOpacity={0.7}
        accessibilityLabel="Atpakaļ"
        accessibilityRole="button"
      >
        <ArrowLeft size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Right slot — same width as back button to keep title centred */}
      <View style={styles.rightWrap}>{rightSlot ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'left',
  },
  rightWrap: {
    minWidth: 36,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
