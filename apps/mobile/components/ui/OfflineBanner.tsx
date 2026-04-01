/**
 * OfflineBanner — slides in from the top when the device loses network connectivity.
 * Safe to mount once at the root level; does nothing when online.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { Text } from '@/components/ui/text';

let NetInfo: typeof import('@react-native-community/netinfo') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  NetInfo = require('@react-native-community/netinfo');
} catch {
  /* Expo Go or native module not linked yet */
}

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (!NetInfo) return;

    const unsub = NetInfo.default.addEventListener((state) => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      Animated.spring(translateY, {
        toValue: offline ? 0 : -80,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }).start();
    });

    return () => unsub();
  }, [translateY]);

  if (!isOffline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.banner, { paddingTop: insets.top + 8, transform: [{ translateY }] }]}
    >
      <View style={styles.row}>
        <WifiOff size={14} color="#fff" strokeWidth={2} />
        <Text style={styles.text}>Nav interneta savienojuma</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1f2937',
    paddingBottom: 10,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
