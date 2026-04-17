import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';

// ── Base shimmer ──────────────────────────────────────────────────────────────
interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
}

// ── Prebuilt skeleton layouts ─────────────────────────────────────────────────

/** Skeleton for a standard list card (order, job, invoice row) */
export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={cardStyles.card}>
          <View style={cardStyles.row}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={60} height={22} radius={11} />
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            <Skeleton width="90%" height={12} />
            <Skeleton width="70%" height={12} />
          </View>
        </View>
      ))}
    </>
  );
}

/** Skeleton for the home screen hero + tiles */
export function SkeletonHome() {
  return (
    <View style={{ padding: 20, gap: 20 }}>
      {/* Greeting block */}
      <View style={{ gap: 8 }}>
        <Skeleton width="50%" height={18} />
        <Skeleton width="35%" height={13} />
      </View>
      {/* Stat strip */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[1, 2, 3].map((k) => (
          <View key={k} style={[cardStyles.card, { flex: 1, gap: 8 }]}>
            <Skeleton width={28} height={28} radius={8} />
            <Skeleton width="70%" height={14} />
            <Skeleton width="50%" height={11} />
          </View>
        ))}
      </View>
      {/* Section title */}
      <Skeleton width="40%" height={15} />
      {/* Cards */}
      <SkeletonCard count={2} />
    </View>
  );
}

/** Skeleton for a full-screen detail page */
export function SkeletonDetail() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {/* Map placeholder */}
      <Skeleton width="100%" height={200} radius={16} />
      {/* Title block */}
      <View style={{ gap: 8 }}>
        <Skeleton width="55%" height={20} />
        <Skeleton width="40%" height={14} />
      </View>
      {/* Info rows */}
      {[1, 2, 3, 4].map((k) => (
        <View key={k} style={[cardStyles.card, cardStyles.row]}>
          <Skeleton width={32} height={32} radius={8} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="75%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Skeleton for driver jobs list */
export function SkeletonJobRow({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[cardStyles.card, { gap: 12 }]}>
          {/* Route line */}
          <View style={cardStyles.row}>
            <View style={{ gap: 6, flex: 1 }}>
              <View style={cardStyles.row}>
                <Skeleton width={8} height={8} radius={4} />
                <Skeleton width="55%" height={14} />
              </View>
              <Skeleton width={2} height={20} style={{ alignSelf: 'flex-start', marginLeft: 3 }} />
              <View style={cardStyles.row}>
                <Skeleton width={8} height={8} radius={4} />
                <Skeleton width="45%" height={14} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Skeleton width={64} height={22} radius={11} />
              <Skeleton width={50} height={12} />
            </View>
          </View>
          {/* Chips */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton width={70} height={24} radius={12} />
            <Skeleton width={80} height={24} radius={12} />
            <Skeleton width={60} height={24} radius={12} />
          </View>
        </View>
      ))}
    </>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgMuted,
    borderRadius: 20,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
