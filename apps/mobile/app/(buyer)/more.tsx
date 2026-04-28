import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { getRoleName } from '@/lib/utils';
import {
  User,
  MessageCircle,
  FileText,
  MapPin,
  Bell,
  AlertCircle,
  BarChart2,
  Calendar,
  Settings,
  HelpCircle,
  Package,
  Truck,
  ChevronRight,
  LogOut,
  Building2,
  ArrowUpDown,
  Euro,
  Handshake,
  FileCheck,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLS = 3;
const H_PAD = 16;
const GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP * (COLS - 1)) / COLS;

type TileItem = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  badge?: number;
  onPress: () => void;
};

function TileGrid({ tiles }: { tiles: TileItem[] }) {
  return (
    <View style={s.grid}>
      {tiles.map((tile, i) => (
        <TouchableOpacity
          key={i}
          style={s.tile}
          activeOpacity={0.72}
          onPress={() => {
            haptics.light();
            tile.onPress();
          }}
        >
          {tile.badge != null && tile.badge > 0 && (
            <View style={s.tileBadge}>
              <Text style={s.tileBadgeText}>{tile.badge > 99 ? '99+' : tile.badge}</Text>
            </View>
          )}
          <tile.icon size={26} color={colors.textSecondary} strokeWidth={1.6} />
          <Text style={s.tileLabel} numberOfLines={2}>
            {tile.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ListRow({
  icon: Icon,
  label,
  onPress,
  isDestructive = false,
  last = false,
}: {
  icon: TileItem['icon'];
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={s.listRow}
        activeOpacity={0.7}
        onPress={() => {
          haptics.light();
          onPress();
        }}
      >
        <Icon size={20} color={isDestructive ? '#dc2626' : colors.textMuted} strokeWidth={1.8} />
        <Text style={[s.listLabel, isDestructive && s.listLabelDestructive]}>{label}</Text>
        <ChevronRight size={16} color={colors.border} />
      </TouchableOpacity>
      {!last && <View style={s.listDivider} />}
    </>
  );
}

export default function MoreScreen() {
  const { user, isLoading, logout } = useAuth();
  const { mode, isMultiRole } = useMode();
  const router = useRouter();

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const accountLabel = user ? getRoleName(user) : 'Viesis';

  /** Redirect guests to register instead of navigating to a protected screen. */
  const requireAuth = (action: () => void) => () => {
    if (!user) {
      router.push('/(auth)/register' as never);
      return;
    }
    action();
  };

  const handleLogout = () => {
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // ── Main navigation tiles (auth-required) ────────────────────
  const mainTiles: TileItem[] = user
    ? [
        {
          icon: MessageCircle,
          label: 'Ziņojumi',
          onPress: requireAuth(() => router.push('/messages')),
        },
        {
          icon: FileText,
          label: 'Dokumenti',
          // Rēķini + Sertifikāti are tabs inside the Documents hub — no separate tile needed
          onPress: requireAuth(() => router.push('/(buyer)/(account)/documents')),
        },
        {
          icon: MapPin,
          label: 'Adreses',
          onPress: requireAuth(() => router.push('/(buyer)/(account)/saved-addresses')),
        },
        {
          icon: Bell,
          label: 'Paziņojumi',
          onPress: requireAuth(() => router.push('/notifications')),
        },
        {
          icon: AlertCircle,
          label: 'Strīdi',
          onPress: requireAuth(() => router.push('/(buyer)/(account)/disputes')),
        },
      ]
    : [];

  // ── Always-public tiles (guests + authenticated) ──────────────
  const publicTiles: TileItem[] = [
    {
      icon: Settings,
      label: 'Iestatījumi',
      onPress: () => router.push('/settings'),
    },
  ];

  // ── Company-only tiles ────────────────────────────────────────
  const companyTiles: TileItem[] = user?.isCompany
    ? [
        {
          icon: BarChart2,
          label: 'Analītika',
          // Full BI lives at web portal — open directly; mobile analytics screen is a stub
          onPress: () => Linking.openURL('https://b3hub.lv/dashboard/analytics').catch(() => null),
        },
        // Sertifikāti tab is inside the Documents hub — no separate tile needed
        {
          icon: Calendar,
          label: 'Grafiki',
          onPress: () => router.push('/(buyer)/(account)/schedules'),
        },
        {
          icon: Building2,
          label: 'Uzņēmums',
          onPress: () => Linking.openURL('https://b3hub.lv/dashboard/company').catch(() => null),
        },
      ]
    : [];

  // ── Seller/carrier mode tiles (if multi-role) ─────────────────
  const roleTiles: TileItem[] =
    mode === 'SUPPLIER'
      ? [
          {
            icon: Package,
            label: 'Katalogs',
            onPress: () => router.push('/(seller)/catalog'),
          },
          {
            icon: Euro,
            label: 'Izpeļņa',
            onPress: () => router.push('/(seller)/earnings'),
          },
          {
            icon: Handshake,
            label: 'Līgumi',
            onPress: () => router.push('/(seller)/framework-contracts'),
          },
          {
            icon: FileCheck,
            label: 'Dokumenti',
            onPress: () => router.push('/(seller)/documents'),
          },
        ]
      : mode === 'CARRIER'
        ? [
            {
              icon: Euro,
              label: 'Izpeļņa',
              onPress: () => router.push('/(driver)/earnings'),
            },
            {
              icon: Truck,
              label: 'Transporti',
              onPress: () => router.push('/(driver)/vehicles'),
            },
            {
              icon: Package,
              label: 'Konteineri',
              onPress: () => router.push('/(driver)/skips'),
            },
            {
              icon: FileCheck,
              label: 'Dokumenti',
              onPress: () => router.push('/(driver)/documents'),
            },
          ]
        : [];

  // ── Become-a-partner tiles — only for company accounts ───────
  // B2C (isCompany: false) homeowners have no interest in becoming suppliers/carriers
  const becomeTiles: TileItem[] = user?.isCompany
    ? [
        ...(!user.canSell
          ? [
              {
                icon: Package,
                label: 'Piegādātājs',
                onPress: () => router.push('/(auth)/apply-role?type=supplier' as never),
              },
            ]
          : []),
        ...(!user.canTransport
          ? [
              {
                icon: Truck,
                label: 'Pārvadātājs',
                onPress: () => router.push('/(auth)/apply-role?type=carrier' as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Vairāk" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Identity card ──────────────────────────────────── */}
        <TouchableOpacity
          style={s.identityCard}
          activeOpacity={0.82}
          onPress={() => {
            haptics.light();
            if (!user) {
              router.push('/(auth)/register' as never);
            } else {
              router.push('/(buyer)/profile');
            }
          }}
        >
          <View style={s.avatar}>
            {initials ? (
              <Text style={s.avatarText}>{initials}</Text>
            ) : (
              <User size={22} color="#fff" strokeWidth={2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            {user ? (
              <>
                <Text style={s.identityName} numberOfLines={1}>
                  {user.firstName} {user.lastName}
                </Text>
                <Text style={s.identityRole}>{accountLabel}</Text>
              </>
            ) : (
              <>
                <Text style={s.identityName}>Viesis</Text>
                <Text style={s.identityRole}>Pierakstieties vai reģistrējieties</Text>
              </>
            )}
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ── Main tiles (auth-required) ─────────────────────── */}
        {!isLoading && !user && (
          <View style={s.guestBanner}>
            <User size={20} color={colors.textMuted} strokeWidth={1.6} />
            <Text style={s.guestBannerText}>
              Pierakstieties, lai piekļūtu pasūtījumiem, dokumentiem un kontam
            </Text>
          </View>
        )}
        {mainTiles.length > 0 && <TileGrid tiles={mainTiles} />}

        {/* ── Company tiles ──────────────────────────────────── */}
        {companyTiles.length > 0 && (
          <>
            <Text style={s.sectionLabel}>UZŅĒMUMS</Text>
            <TileGrid tiles={companyTiles} />
          </>
        )}

        {/* ── Role tiles (supplier / carrier) ────────────────── */}
        {roleTiles.length > 0 && (
          <>
            <Text style={s.sectionLabel}>MANA LOMA</Text>
            <TileGrid tiles={roleTiles} />
          </>
        )}

        {/* ── Role switch ────────────────────────────────────── */}
        {isMultiRole && (
          <>
            <Text style={s.sectionLabel}>LOMA</Text>
            <View style={s.listCard}>
              <ListRow
                icon={ArrowUpDown}
                label="Mainīt lomu"
                last
                onPress={() => {
                  // Navigate to profile where the RoleSheet lives, or trigger directly
                  router.push('/(buyer)/profile');
                }}
              />
            </View>
          </>
        )}

        {/* ── Become a partner ───────────────────────────────── */}
        {becomeTiles.length > 0 && (
          <>
            <Text style={s.sectionLabel}>KĻŪT PAR PARTNERI</Text>
            <TileGrid tiles={becomeTiles} />
          </>
        )}

        {/* ── Public tiles (settings — always visible) ───────── */}
        <Text style={s.sectionLabel}>KONTS</Text>
        <TileGrid tiles={publicTiles} />

        {/* ── Help & support ─────────────────────────────────── */}
        <Text style={s.sectionLabel}>PALĪDZĪBA</Text>
        <View style={s.listCard}>
          <ListRow icon={HelpCircle} label="Palīdzība / BUJ" onPress={() => router.push('/help')} />
          <ListRow
            icon={MessageCircle}
            label="Atbalsts"
            last
            onPress={() => router.push('/support-chat' as never)}
          />
        </View>

        {/* ── Sign out ───────────────────────────────────────── */}
        {user ? (
          <View style={s.listCard}>
            <ListRow icon={LogOut} label="Iziet" isDestructive last onPress={handleLogout} />
          </View>
        ) : (
          <View style={s.guestActions}>
            <TouchableOpacity
              style={s.guestPrimary}
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register' as never);
              }}
            >
              <Text style={s.guestPrimaryText}>Izveidot kontu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.guestSecondary}
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/login' as never);
              }}
            >
              <Text style={s.guestSecondaryText}>Jau ir konts? Ieiet</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
  },

  // Identity card
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    marginHorizontal: H_PAD,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F9423A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  identityName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  identityRole: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },

  // Tile grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: GAP,
    marginBottom: 8,
  },
  tile: {
    width: TILE_W,
    minHeight: 90,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    gap: 8,
  },
  tileLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: H_PAD + 4,
    marginTop: 20,
    marginBottom: 10,
  },

  // List card
  listCard: {
    backgroundColor: colors.bgCard,
    marginHorizontal: H_PAD,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
  },
  listLabelDestructive: {
    color: '#dc2626',
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 48,
  },

  // Guest banner
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    marginHorizontal: H_PAD,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 18,
  },

  // Guest actions
  guestActions: {
    marginHorizontal: H_PAD,
    marginTop: 16,
    gap: 10,
  },
  guestPrimary: {
    backgroundColor: '#F9423A',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  guestPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  guestSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestSecondaryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
});
