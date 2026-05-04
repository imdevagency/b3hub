import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, ShoppingCart, Store, Truck } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { useMode, AppMode, MODE_HOME } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<AppMode, { Icon: React.ElementType; label: string; desc: string }> = {
  BUYER: {
    Icon: ShoppingCart,
    label: 'Pircējs',
    desc: 'Pasūtīt materiālus un piegādes',
  },
  SUPPLIER: {
    Icon: Store,
    label: 'Pārdevējs',
    desc: 'Pārdot materiālus, cenu piedāvājumi',
  },
  CARRIER: {
    Icon: Truck,
    label: 'Vadītājs',
    desc: 'Piegādes darbi un maršruti',
  },
};

// ── Role picker bottom-sheet ──────────────────────────────────────────────────

export function RoleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { mode, setMode, availableModes } = useMode();
  const router = useRouter();

  const translateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Always reset to offscreen before animating in so repeat opens work correctly
      translateY.setValue(300);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          mass: 0.6,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (m: AppMode) => {
    if (m === mode) {
      onClose();
      return;
    }
    haptics.light();
    setMode(m);
    onClose();
    setTimeout(() => router.replace(MODE_HOME[m] as Href), 220);
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={styles.sheetTitle}>Mainīt lomu</Text>

        <View style={styles.roleList}>
          {availableModes.map((m) => {
            const cfg = ROLE_CFG[m];
            const isActive = m === mode;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.roleRow, isActive && styles.roleRowActive]}
                onPress={() => handleSelect(m)}
                activeOpacity={0.7}
              >
                <View style={[styles.roleIconWrap, isActive && styles.roleIconWrapActive]}>
                  <cfg.Icon size={20} color={isActive ? '#ffffff' : '#111827'} strokeWidth={2} />
                </View>
                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, isActive && styles.roleLabelActive]}>
                    {cfg.label}
                  </Text>
                  <Text style={[styles.roleDesc, isActive && styles.roleDescActive]}>
                    {cfg.desc}
                  </Text>
                </View>
                {isActive && (
                  <View style={styles.checkWrap}>
                    <Check size={16} color="#ffffff" strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDisabled,
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleList: {
    gap: 12,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  roleRowActive: {
    backgroundColor: colors.primary,
    borderColor: colors.textPrimary,
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: colors.primaryMid,
  },
  roleText: {
    flex: 1,
    marginLeft: 16,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  roleLabelActive: {
    color: colors.white,
  },
  roleDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  roleDescActive: {
    color: colors.textDisabled,
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
