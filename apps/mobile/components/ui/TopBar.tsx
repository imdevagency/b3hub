import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, Check, ArrowUpDown, Menu, ShoppingCart, Store, Truck } from 'lucide-react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { useMode, AppMode, MODE_HOME } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';

// Maps the last URL segment → display title using t.nav as the single source of truth
const SEGMENT_TITLE: Record<string, string> = {
  home: t.nav.home,
  orders: t.nav.orders,
  profile: t.nav.profile,
  jobs: t.nav.jobs,
  active: t.nav.active,
  earnings: t.nav.earnings,
  incoming: t.nav.incoming,
  catalog: t.nav.catalog,
  quotes: t.nav.quotes,
  skips: t.nav.skips,
  invoices: t.nav.invoices,
  containers: t.nav.containers,
  certificates: t.nav.certificates,
  projects: t.nav.projects,
  team: t.nav.team,
  vehicles: t.nav.vehicles,
  notifications: t.nav.notifications,
  messages: t.nav.messages,
  settings: t.nav.settings,
  order: t.nav.order,
  project: t.nav.project,
  disposal: t.nav.disposal,
  transport: t.nav.transport,
  chat: t.nav.chat,
  schedule: t.nav.schedule,
};

function titleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  // Walk from the end, skip dynamic segments like [id]
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.startsWith('[') && seg.endsWith(']')) continue;
    const found = SEGMENT_TITLE[seg];
    if (found) return found;
  }
  return t.nav.fallback;
}

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

// ── TopBar ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  /** Optional title to display in center. If omitted, uses smart path title. Does not show if centerElement is provided. */
  title?: string;
  /** Accent color for icons/text. */
  accentColor?: string;
  /** If provided, renders a hamburger menu button that calls this on press. */
  onMenuPress?: () => void;
  /** Unread notification count. */
  unreadCount?: number;
  /** Component to render in the left slot. Takes precedence over onMenuPress. */
  leftElement?: React.ReactNode;
  /** Component to render in the center slot. Takes precedence over title. */
  centerElement?: React.ReactNode;
  /** Component to render in the right slot, along with notifications. */
  rightElement?: React.ReactNode;
  /** Whether the background should be transparent (e.g. over maps) instead of solid white. */
  transparent?: boolean;
}

export function TopBar({
  title,
  accentColor = '#111827',
  onMenuPress,
  unreadCount = 0,
  leftElement,
  centerElement,
  rightElement,
  transparent = false,
}: TopBarProps) {
  const { isMultiRole } = useMode();
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayTitle = title ?? titleFromPath(pathname);

  // Left slot content
  const renderLeft = () => {
    if (leftElement) return leftElement;
    if (onMenuPress) {
      return (
        <TouchableOpacity
          onPress={onMenuPress}
          hitSlop={10}
          style={transparent ? styles.floatingBtn : styles.sideBtn}
          activeOpacity={0.7}
        >
          <Menu size={24} color={accentColor} />
        </TouchableOpacity>
      );
    }
    return <View style={{ width: 44 }} />; // Placeholder
  };

  // Center slot content
  const renderCenter = () => {
    if (centerElement) return centerElement;
    if (!transparent && displayTitle) {
      return <Text style={[styles.logo, { color: accentColor }]}>{displayTitle}</Text>;
    }
    return null;
  };

  // Right slot content
  const renderRight = () => {
    return (
      <View style={styles.rightGroup}>
        {rightElement}
        {isMultiRole && (
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setSheetOpen(true);
            }}
            hitSlop={10}
            style={transparent ? styles.floatingBtn : styles.sideBtn}
            activeOpacity={0.7}
          >
            <ArrowUpDown size={20} color={accentColor} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          hitSlop={10}
          style={transparent ? styles.floatingBtn : styles.sideBtn}
          activeOpacity={0.7}
        >
          <View>
            <Bell size={22} color={accentColor} />
            {unreadCount > 0 && <View style={styles.badge} />}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <View
        style={[styles.bar, transparent ? styles.barTransparent : styles.barSolid]}
        pointerEvents="box-none"
      >
        <View style={styles.leftContainer}>{renderLeft()}</View>
        <View style={styles.centerContainer}>{renderCenter()}</View>
        <View style={styles.rightContainer}>{renderRight()}</View>
      </View>

      {isMultiRole && <RoleSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
  },
  barSolid: {
    backgroundColor: '#ffffff',
    // borderBottomWidth: 1, // Removed to match premium feel as requested previously
    // borderBottomColor: '#f3f4f6', // Removed
    paddingHorizontal: 16,
  },
  barTransparent: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    // Removed marginTop: 12 from here as it was causing the huge gap
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  floatingBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  backdrop: {
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
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
    fontWeight: '700',
    color: '#9ca3af',
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
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: '#374151',
  },
  roleText: {
    flex: 1,
    marginLeft: 16,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  roleLabelActive: {
    color: '#ffffff',
  },
  roleDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  roleDescActive: {
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
