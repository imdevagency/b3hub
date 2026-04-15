/**
 * BottomSheet — reusable slide-up bottom sheet.
 *
 * Backdrop fades in/out independently.
 * Sheet slides up/down from the bottom.
 *
 * Props:
 *   visible       – controls open/close
 *   onClose       – called when backdrop or X is tapped
 *   title         – optional header title
 *   subtitle      – optional subtext below title
 *   hideHandle    – hide the top drag handle (default false)
 *   scrollable    – wrap children in a ScrollView (default false)
 *   maxHeightPct  – max height as % of screen height (default 0.92)
 *   children      – sheet content
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

const DURATION_IN = 280;
const DURATION_OUT = 220;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  hideHandle?: boolean;
  scrollable?: boolean;
  maxHeightPct?: number;
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  hideHandle = false,
  scrollable = false,
  maxHeightPct = 0.92,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const maxHeight = SCREEN_H * maxHeightPct;

  // Keep modal mounted until exit animation completes
  const [modalMounted, setModalMounted] = useState(visible);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_H)).current;

  const animateIn = useCallback(() => {
    setModalMounted(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: DURATION_IN,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: DURATION_IN,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: DURATION_OUT,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_H,
        duration: DURATION_OUT,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setModalMounted(false));
  }, [backdropOpacity, sheetTranslateY]);

  useEffect(() => {
    if (visible) {
      animateIn();
    } else {
      animateOut();
    }
  }, [visible, animateIn, animateOut]);

  const header =
    title || subtitle ? (
      <View style={s.header}>
        <View style={s.headerText}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Aizvērt"
          accessibilityRole="button"
        >
          <X size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        style={s.closeCorner}
        onPress={onClose}
        hitSlop={12}
        accessibilityLabel="Aizvērt"
        accessibilityRole="button"
      >
        <X size={20} color="#9ca3af" />
      </TouchableOpacity>
    );

  return (
    <Modal
      visible={modalMounted}
      animationType="none"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      {/* Backdrop — fades independently */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Aizvērt lapu"
          accessibilityRole="button"
        />
      </Animated.View>

      {/* Sheet — slides up from bottom */}
      <Animated.View
        style={[
          s.sheet,
          { maxHeight, paddingBottom: Math.max(insets.bottom, 24) },
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        {!hideHandle && <View style={s.handle} />}
        {header}

        {scrollable ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {children}
          </ScrollView>
        ) : (
          <View>{children}</View>
        )}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerText: { flex: 1, marginRight: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  closeCorner: { position: 'absolute', top: 14, right: 18 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 16, gap: 2 },
});
