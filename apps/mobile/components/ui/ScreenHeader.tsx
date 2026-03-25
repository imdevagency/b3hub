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
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

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
}

export function ScreenHeader({ title, rightAction, onBack, showBack }: ScreenHeaderProps) {
  const router = useRouter();
  const navigation = useNavigation();

  // If onBack is explicitly null, hide back button.
  // Otherwise, use canGoBack() or force showBack.
  const shouldShowBack = onBack !== null && (showBack || navigation.canGoBack());

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View className="flex-row items-center justify-between px-5 pt-3 pb-3 bg-white border-b border-gray-100 min-h-[56px]">
      <View className="flex-row items-center flex-1 gap-1">
        {shouldShowBack && (
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 -ml-2 items-center justify-center rounded-full active:bg-gray-100"
            hitSlop={8}
            activeOpacity={0.6}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
        )}
        <Text className="text-[20px] font-bold text-[#111827] flex-1" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {rightAction && <View className="flex-row items-center pl-4">{rightAction}</View>}
    </View>
  );
}
