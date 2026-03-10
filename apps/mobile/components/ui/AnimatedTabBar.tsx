/**
 * AnimatedTabBar — custom bottom tab bar with:
 *  • A sliding top-indicator that follows the active tab (spring physics)
 *  • Icon scale + label opacity animations on each press
 *  • Ripple-free, 60 fps via react-native-reanimated
 */
import React, { useCallback } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_HEIGHT = 62;

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 220,
  mass: 0.4,
  overshootClamping: false,
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
  const progress = useSharedValue(isFocused ? 1 : 0);

  // Sync when focus changes from outside (e.g. deep link)
  React.useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG);
  }, [isFocused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.96, 1.1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0.55, 1],
      Extrapolation.CLAMP,
    ),
  }));

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
      <Animated.View style={iconStyle}>
        {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
      </Animated.View>
      <Animated.Text
        style={[
          styles.label,
          { color },
          labelStyle,
        ]}
        numberOfLines={1}
      >
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
  const visibleRoutes = state.routes.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => descriptors[r.key]?.options?.href !== null,
  );

  const effectiveCount = visibleRoutes.length;
  const tabWidth = effectiveCount > 0 ? SCREEN_WIDTH / effectiveCount : SCREEN_WIDTH;

  // Which visible-route index is active?
  const activeVisibleIdx = visibleRoutes.findIndex(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.key === state.routes[state.index]?.key,
  );

  const indicatorX = useSharedValue(
    Math.max(0, activeVisibleIdx) * tabWidth,
  );

  React.useEffect(() => {
    const idx = Math.max(0, activeVisibleIdx);
    indicatorX.value = withSpring(idx * tabWidth, SPRING_CONFIG);
  }, [activeVisibleIdx, tabWidth]);

  // Indicator is a 3px bar centered in the tab, 32px wide
  const INDICATOR_W = 32;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value + (tabWidth - INDICATOR_W) / 2 }],
  }));

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
    <View style={styles.container}>
      {/* Sliding top indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Tab items */}
      <View style={styles.row}>
        {visibleRoutes.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (route: any) => {
            // Find this route's index in the full routes array to compare with state.index
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
    height: TAB_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 20,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  row: {
    flex: 1,
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
