import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useAvatarUpload } from '@/lib/use-avatar-upload';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import {
  Euro,
  FileText,
  Handshake,
  Tag,
  MessageCircle,
  Bell,
  Settings,
  HelpCircle,
  ChevronRight,
  LogOut,
  Building2,
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

export default function SellerMoreScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar ?? null);

  const { pick: pickAvatar, uploading: avatarUploading } = useAvatarUpload({
    type: 'user',
    onSuccess: (url) => {
      setAvatarUrl(url);
      if (user) updateUser({ ...user, avatar: url });
    },
  });

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

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

  const tiles: TileItem[] = [
    { icon: Euro, label: 'Izpeļņa', onPress: () => router.push('/(seller)/earnings') },
    { icon: Tag, label: 'Piedāvājumi', onPress: () => router.push('/(seller)/quotes') },
    { icon: FileText, label: 'Dokumenti', onPress: () => router.push('/(seller)/documents') },
    {
      icon: Handshake,
      label: 'Līgumi',
      onPress: () => router.push('/(seller)/framework-contracts'),
    },
    { icon: MessageCircle, label: 'Ziņojumi', onPress: () => router.push('/messages') },
    { icon: Bell, label: 'Paziņojumi', onPress: () => router.push('/notifications') },
    { icon: Settings, label: 'Iestatījumi', onPress: () => router.push('/settings') },
  ];

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Vairāk" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Identity card */}
        <View style={s.identityCard}>
          <AvatarImage
            url={avatarUrl}
            initials={initials}
            size={52}
            onPress={pickAvatar}
            loading={avatarUploading}
          />
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.82}
            onPress={() => {
              haptics.light();
              router.push('/(seller)/profile');
            }}
          >
            <Text style={s.identityName} numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={s.identityRole}>Piegādātājs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.push('/(seller)/profile');
            }}
          >
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {/* Main tiles */}
        <TileGrid tiles={tiles} />
        {/* Company */}
        <Text style={s.sectionLabel}>UZŅĒMUMS</Text>
        <View style={s.listCard}>
          <ListRow
            icon={Building2}
            label="Norēķinu iestatījumi"
            last
            onPress={() => router.push('/(seller)/billing-settings')}
          />
        </View>
        {/* Help */}
        <Text style={s.sectionLabel}>PALĪDZĪBA</Text>{' '}
        <View style={s.listCard}>
          <ListRow icon={HelpCircle} label="Palīdzība / BUJ" onPress={() => router.push('/help')} />
          <ListRow
            icon={MessageCircle}
            label="Atbalsts"
            last
            onPress={() => router.push('/support-chat' as never)}
          />
        </View>
        {/* Sign out */}
        <View style={s.listCard}>
          <ListRow icon={LogOut} label="Iziet" isDestructive last onPress={handleLogout} />
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 32 },

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
  identityName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  identityRole: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted },

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
  listLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textPrimary },
  listLabelDestructive: { color: '#dc2626' },
  listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 48 },
});
