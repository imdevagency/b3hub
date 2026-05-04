import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, ArrowUpDown, Menu } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useMode } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { colors } from '@/lib/theme';
import { RoleSheet } from '@/components/ui/RoleSheet';

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
          accessibilityLabel="Izvēlne"
          accessibilityRole="button"
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
          accessibilityLabel={
            unreadCount > 0 ? `Paziņojumi, ${unreadCount} nelastīti` : 'Paziņojumi'
          }
          accessibilityRole="button"
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
    backgroundColor: 'transparent',
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
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#f4f5f7',
  },
});

// Re-export for backward compatibility — import from '@/components/ui/RoleSheet' directly.
export { RoleSheet } from '@/components/ui/RoleSheet';
