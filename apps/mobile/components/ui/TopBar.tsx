import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, Check, ArrowUpDown, Menu, ShoppingCart, Store, Truck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMode, AppMode, MODE_HOME } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<AppMode, { icon: React.ReactNode; label: string; desc: string }> = {
  buyer: {
    icon: <ShoppingCart size={20} color="#111827" strokeWidth={2} />,
    label: 'Pircējs',
    desc: 'Pasūtīt materiālus un piegādes',
  },
  seller: {
    icon: <Store size={20} color="#111827" strokeWidth={2} />,
    label: 'Pārdevējs',
    desc: 'Pārdot materiālus, cenu piedāvājumi',
  },
  driver: {
    icon: <Truck size={20} color="#111827" strokeWidth={2} />,
    label: 'Vadītājs',
    desc: 'Piegādes darbi un maršruti',
  },
};

// ── Role picker bottom-sheet ──────────────────────────────────────────────────

function RoleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    setTimeout(() => router.replace(MODE_HOME[m] as any), 220);
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
                  {cfg.icon}
                </View>
                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, isActive && styles.roleLabelActive]}>
                    {cfg.label}
                  </Text>
                  <Text style={styles.roleDesc}>{cfg.desc}</Text>
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

// ── TopBar ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  title?: string;
  accentColor: string;
  onMenuPress: () => void;
  unreadCount?: number;
}

export function TopBar({
  title = 'B3Hub',
  accentColor,
  onMenuPress,
  unreadCount = 0,
}: TopBarProps) {
  const { isMultiRole } = useMode();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <View style={styles.bar}>
        {/* Left — hamburger */}
        <TouchableOpacity
          onPress={onMenuPress}
          hitSlop={10}
          style={styles.sideBtn}
          activeOpacity={0.7}
        >
          <Menu size={24} color="#374151" />
        </TouchableOpacity>

        {/* Center — logo */}
        <View style={styles.center}>
          <Text style={[styles.logo, { color: accentColor }]}>{title}</Text>
        </View>

        {/* Right — role switcher + bell */}
        <View style={styles.rightGroup}>
          {isMultiRole && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setSheetOpen(true);
              }}
              hitSlop={10}
              style={styles.sideBtn}
              activeOpacity={0.7}
            >
              <ArrowUpDown size={20} color="#374151" strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            hitSlop={10}
            style={styles.sideBtn}
            activeOpacity={0.7}
          >
            <View>
              <Bell size={22} color="#374151" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {isMultiRole && <RoleSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  sideBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // ── Badge ──
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── Sheet ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  roleList: {
    paddingHorizontal: 12,
    gap: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  roleRowActive: {
    backgroundColor: '#f3f4f6',
  },
  roleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleIconWrapActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  roleText: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  roleLabelActive: {
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 12,
    color: '#9ca3af',
  },
  checkWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
