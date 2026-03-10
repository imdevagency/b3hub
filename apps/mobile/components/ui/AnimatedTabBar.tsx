/**
 * AnimatedTabBar — custom bottom tab bar.
 * Uses React Native's built-in Animated API (NOT react-native-reanimated)
 * to avoid JSI HostFunction crashes in Expo Go.
 */
import React, { useCallback, useRef, useEffect } from 'react';
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_HEIGHT = 62;
const INDICATOR_W = 32;

const SPRING_BASE = {
  damping: 22,
  stiffness: 220,
  mass: 0.4,
  useNativeDriver: true as const,
};

interface AnimatedTabBarProps {
  // Standard react-navigation BottomTabBar props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptors: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  route: any;
  isFocused: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor: any;
  onPress: () => void;
  onLongPress: () => void;
  activeTint: string;
  inactiveTint: string;
}) {
  const scale = useRef(new Animated.Value(isFocused ? 1.1 : 0.96)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.55)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: isFocused ? 1.1 : 0.96, ...SPRING_BASE }),
      Animated.spring(labelOpacity, { toValue: isFocused ? 1 : 0.55, ...SPRING_BASE }),
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
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
      </Animated.View>
      <Animated.Text style={[styles.label, { color, opacity: labelOpacity }]} numberOfLines={1}>
        {label}
      </Animated.Text>
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

  const visibleRoutes = state.routes.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => {
      const opts = descriptors[r.key]?.options;
      // expo-router converts href:null → tabBarButton: () => null in descriptor options
      if (typeof opts?.tabBarButton === 'function') return false;
      return true;
    },
  );

  const effectiveCount = visibleRoutes.length;
  const tabWidth = effectiveCount > 0 ? SCREEN_WIDTH / effectiveCount : SCREEN_WIDTH;

  const activeVisibleIdx = visibleRoutes.findIndex(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.key === state.routes[state.index]?.key,
  );

  const indicatorX = useRef(
    new Animated.Value(Math.max(0, activeVisibleIdx) * tabWidth + (tabWidth - INDICATOR_W) / 2),
  ).current;

  useEffect(() => {
    const idx = Math.max(0, activeVisibleIdx);
    Animated.spring(indicatorX, {
      toValue: idx * tabWidth + (tabWidth - INDICATOR_W) / 2,
      ...SPRING_BASE,
    }).start();
  }, [activeVisibleIdx, tabWidth]);

  const handlePress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (route: any, isFocused: boolean) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate({ name: route.name, merge: true });
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (route: any) => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    },
    [navigation],
  );

  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
      {/* Sliding top indicator */}
      <Animated.View style={[styles.indicator, { transform: [{ translateX: indicatorX }] }]} />

      {/* Tab items */}
      <View style={styles.row}>
        {visibleRoutes.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (route: any) => {
            const fullIdx = state.routes.findIndex(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (r: any) => r.key === route.key,
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
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 20,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#111827',
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
    paddingBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
