/**
 * BottomSheet — reusable slide-up bottom sheet.
 *
 * Usage (static content):
 *   <BottomSheet visible={open} onClose={close} title="My sheet">
 *     <Text>Content</Text>
 *   </BottomSheet>
 *
 * Usage (scrollable content — long forms, lists):
 *   <BottomSheet visible={open} onClose={close} title="My sheet" scrollable>
 *     <Text>Lots of content...</Text>
 *   </BottomSheet>
 *
 * Props:
 *   visible       – controls Modal visibility
 *   onClose       – called when backdrop or X is tapped
 *   title         – optional header title text
 *   subtitle      – optional subtext below title
 *   hideHandle    – hide the top drag handle (default false)
 *   scrollable    – wrap children in a ScrollView (default false)
 *   maxHeightPct  – max height as % of screen, default 0.92
 *   children      – sheet content
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

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

  const sheetPadding = { paddingBottom: Math.max(insets.bottom, 24) };

  const header =
    title || subtitle ? (
      <View style={s.header}>
        <View style={s.headerText}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    ) : (
      /* No title: just an X in the corner */
      <TouchableOpacity style={s.closeCorner} onPress={onClose} hitSlop={12}>
        <X size={20} color="#9ca3af" />
      </TouchableOpacity>
    );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to close */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[s.sheet, { maxHeight }, sheetPadding]}>
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
      </View>
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
