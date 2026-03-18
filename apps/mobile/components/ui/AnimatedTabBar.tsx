/**
 * AnimatedTabBar — custom bottom tab bar.
 * Uses React Native's built-in Animated API (NOT react-native-reanimated)
 * to avoid JSI HostFunction crashes in Expo Go.
 */
import React, { useCallback, useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { Route } from '@react-navigation/native';

const TAB_HEIGHT = 56;

const SPRING_BASE = {
  damping: 22,
  stiffness: 220,
  mass: 0.4,
  useNativeDriver: true as const,
};

interface AnimatedTabBarProps extends BottomTabBarProps {
  /** Active tab tint (indicator + icon). Default #111827 */
  activeTint?: string;
  /** Inactive icon + label color. Default #9ca3af */
  inactiveTint?: string;
}

function TabItem({
  route,
  isFocused,
  descriptor,
  onPress,
  onLongPress,
  activeTint,
  inactiveTint,
}: {
  route: Route<string>;
  isFocused: boolean;
  descriptor: BottomTabBarProps['descriptors'][string];
  onPress: () => void;
  onLongPress: () => void;
  activeTint: string;
  inactiveTint: string;
}) {
  const scale = useRef(new Animated.Value(isFocused ? 1.08 : 0.96)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: isFocused ? 1.08 : 0.96, ...SPRING_BASE }),
      Animated.spring(labelOpacity, { toValue: isFocused ? 1 : 0.5, ...SPRING_BASE }),
    ]).start();
  }, [isFocused]);

  const { options } = descriptor;
  const label =
    options.tabBarLabel !== undefined
      ? (options.tabBarLabel as string)
      : options.title !== undefined
        ? options.title
        : route.name;

  const color = isFocused ? activeTint : inactiveTint;

  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View>
          {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
          {!!options.tabBarBadge && (
            <View style={styles.badge}>
              {typeof options.tabBarBadge === 'number' && options.tabBarBadge > 0 && (
                <Text style={styles.badgeText}>
                  {options.tabBarBadge > 99 ? '99+' : options.tabBarBadge}
                </Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
      <Animated.Text style={[styles.label, { color, opacity: labelOpacity }]} numberOfLines={1}>
        {label}
      </Animated.Text>
      {/* Dot removed — activePill is the sole active indicator */}
    </TouchableOpacity>
  );
}

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  activeTint = '#111827',
  inactiveTint = '#9ca3af',
}: AnimatedTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  // Guard: bail out safely if the navigator hasn't fully initialised yet
  if (!state || !navigation || !descriptors) return null;

  const visibleRoutes = state.routes.filter(
    (r: Route<string>) => {
      const opts = descriptors[r.key]?.options;
      // expo-router converts href:null → tabBarButton: () => null in descriptor options
      if (typeof opts?.tabBarButton === 'function') return false;
      return true;
    },
  );

  const handlePress = useCallback(
    (route: Route<string>, isFocused: boolean) => {
      haptics.selection();
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    (route: Route<string>) => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
      {/* Tab items — dot indicator is per-item, no sliding bar */}
      <View style={styles.row}>
        {visibleRoutes.map(
          (route: Route<string>) => {
            const fullIdx = state.routes.findIndex(
              (r: Route<string>) => r.key === route.key,
            );
            const isFocused = state.index === fullIdx;
            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                descriptor={descriptors[route.key]}
                onPress={() => handlePress(route, isFocused)}
                onLongPress={() => handleLongPress(route)}
                activeTint={activeTint}
                inactiveTint={inactiveTint}
              />
            );
          },
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 16,
  },
  row: {
    height: TAB_HEIGHT,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 8,
    paddingBottom: 6,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.1,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 13,
  },
});
