/**
 * AnimatedTabBar — custom bottom tab bar.
 * Uses React Native's built-in Animated API (NOT react-native-reanimated)
 * to avoid JSI HostFunction crashes in Expo Go.
 */
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { Route } from '@react-navigation/native';

/** Config for a raised CTA button inserted in the centre of the tab row. */
export interface CtaTabConfig {
  /** Icon element rendered inside the pill (should be already coloured white). */
  icon: React.ReactNode;
  /** Called when the user taps the CTA button. */
  onPress: () => void;
  accessibilityLabel?: string;
}

const TAB_HEIGHT = 64;

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
  /**
   * When provided, a raised pill button is injected in the centre of the tab row.
   * It does not correspond to any route — pressing it calls `ctaTab.onPress`.
   */
  ctaTab?: CtaTabConfig;
  /**
   * Optional press interceptor.  When a tab is pressed, this is called with the
   * route name and a `defaultHandler` that performs the standard navigation.
   * If omitted, `defaultHandler` is invoked directly.
   */
  /**
   * Maps hidden route names to a visible route that should appear active in their place.
   * e.g. { active: 'jobs' } makes the `jobs` tab highlight when the hidden `active` route is shown.
   */
  hiddenRouteAliases?: Record<string, string>;
  onRoutePress?: (routeName: string, defaultHandler: () => void) => void;
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

  useEffect(() => {
    Animated.spring(scale, { toValue: isFocused ? 1.08 : 0.96, ...SPRING_BASE }).start();
  }, [isFocused]);

  const { options } = descriptor;

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
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
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
        {!!options.title && (
          <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>
            {options.title}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

function CtaButton({ config }: { config: CtaTabConfig }) {
  return (
    <TouchableOpacity
      style={styles.ctaWrap}
      onPress={() => {
        haptics.selection();
        config.onPress();
      }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={config.accessibilityLabel ?? 'Pasūtīt'}
    >
      <View style={styles.ctaPill}>{config.icon}</View>
    </TouchableOpacity>
  );
}

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  activeTint = '#111827',
  inactiveTint = '#9ca3af',
  ctaTab,
  hiddenRouteAliases,
  onRoutePress,
}: AnimatedTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(1)).current;
  const [barWidth, setBarWidth] = useState(0);
  const layoutSetRef = useRef(false);

  const isReady = !!(state && navigation && descriptors);

  const visibleRoutes = isReady
    ? state.routes.filter((r: Route<string>) => {
        const descriptor = descriptors[r.key];
        // Descriptor not yet hydrated — skip to avoid "stale" crash during cold start
        if (!descriptor) return false;
        const opts = descriptor.options;
        // expo-router converts href:null → tabBarButton: () => null in descriptor options
        if (typeof opts?.tabBarButton === 'function') return false;
        return true;
      })
    : [];

  // CTA is inserted after the centre-left tab so it visually sits in the middle.
  const ctaInsertIndex = ctaTab ? Math.ceil(visibleRoutes.length / 2) : -1;
  const totalItems = visibleRoutes.length + (ctaTab ? 1 : 0);

  // Slide top indicator to sit above the active tab
  useEffect(() => {
    if (!isReady || barWidth === 0 || visibleRoutes.length === 0) return;
    const currentRouteName = state.routes[state.index]?.name;
    const aliasedName = hiddenRouteAliases?.[currentRouteName] ?? null;
    const activeVisibleIdx = visibleRoutes.findIndex((r: Route<string>) => {
      const fullIdx = state.routes.findIndex((x: Route<string>) => x.key === r.key);
      return aliasedName ? aliasedName === r.name : state.index === fullIdx;
    });

    // No matching visible tab — hide indicator instead of snapping to tab 0
    if (activeVisibleIdx < 0) {
      Animated.timing(indicatorOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(indicatorOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    const idx = activeVisibleIdx;
    const tabW = barWidth / (totalItems || 1);
    // If CTA slot is inserted before this tab's visual position, shift right by one slot
    const ctaOffset = ctaTab && ctaInsertIndex >= 0 && idx >= ctaInsertIndex ? 1 : 0;
    const toValue = (idx + ctaOffset) * tabW;

    if (!layoutSetRef.current) {
      // First layout — snap without animation to avoid slide-in from 0
      indicatorX.setValue(toValue);
      layoutSetRef.current = true;
    } else {
      Animated.spring(indicatorX, { toValue, ...SPRING_BASE }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.index, barWidth, isReady, visibleRoutes.length]);

  const handlePress = useCallback(
    (route: Route<string>, isFocused: boolean) => {
      haptics.selection();
      const defaultHandler = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };
      if (onRoutePress) {
        onRoutePress(route.name, defaultHandler);
      } else {
        defaultHandler();
      }
    },
    [navigation, onRoutePress],
  );

  const handleLongPress = useCallback(
    (route: Route<string>) => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    },
    [navigation],
  );

  if (!isReady) return null;

  return (
    <View style={[styles.container, { paddingBottom: bottomInset }]}>
      <View
        style={styles.row}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w !== barWidth) setBarWidth(w);
        }}
      >
        {/* Sliding top indicator */}
        {barWidth > 0 &&
          (() => {
            const tabW = barWidth / (totalItems || 1);
            const indicatorW = tabW * 0.55;
            const centerOffset = (tabW - indicatorW) / 2;
            return (
              <Animated.View
                style={[
                  styles.indicator,
                  {
                    width: indicatorW,
                    backgroundColor: activeTint,
                    opacity: indicatorOpacity,
                    transform: [{ translateX: Animated.add(indicatorX, centerOffset) }],
                  },
                ]}
              />
            );
          })()}
        {visibleRoutes.map((route: Route<string>, visibleIdx: number) => {
          const fullIdx = state.routes.findIndex((r: Route<string>) => r.key === route.key);
          const currentRouteName = state.routes[state.index]?.name;
          // If the active route is hidden (e.g. 'active') and has an alias (e.g. 'jobs'),
          // highlight the aliased tab instead.
          const aliasedName = hiddenRouteAliases?.[currentRouteName] ?? null;
          const isFocused = aliasedName ? aliasedName === route.name : state.index === fullIdx;
          return (
            <React.Fragment key={route.key}>
              {ctaTab && visibleIdx === ctaInsertIndex && <CtaButton config={ctaTab} />}
              <TabItem
                route={route}
                isFocused={isFocused}
                descriptor={descriptors[route.key]}
                onPress={() => handlePress(route, isFocused)}
                onLongPress={() => handleLongPress(route)}
                activeTint={activeTint}
                inactiveTint={inactiveTint}
              />
            </React.Fragment>
          );
        })}
        {ctaTab && ctaInsertIndex === visibleRoutes.length && <CtaButton config={ctaTab} />}
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
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabInner: {
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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
  ctaWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    // Raise the pill above the tab bar line
    marginBottom: 6,
  },
});
