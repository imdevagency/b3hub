import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TileGrid, TileItem, H_PAD } from '@/components/ui/TileGrid';
import { ListRow } from '@/components/ui/ListRow';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { useLogoutConfirm } from '@/lib/use-logout-confirm';
import { colors } from '@/lib/theme';
import {
  User,
  CalendarDays,
  Truck,
  Package,
  Toilet,
  FileText,
  MessageCircle,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Users,
  Building2,
} from 'lucide-react-native';

export default function DriverMoreScreen() {
  const { user } = useAuth();
  useMode();
  const router = useRouter();

  const handleLogout = useLogoutConfirm();

  const canManageTeam =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    (user?.permManageTeam ?? false);

  const mainTiles: TileItem[] = [
    { icon: User, label: 'Profils', onPress: () => router.push('/(driver)/profile') },
    { icon: Truck, label: 'Transporti', onPress: () => router.push('/(driver)/vehicles') },
    ...(user?.canSkipHire
      ? [
          {
            icon: Package,
            label: 'Konteineri',
            onPress: () => router.push('/(driver)/skips'),
          } as TileItem,
          {
            icon: Toilet,
            label: 'Kabīnes',
            onPress: () => router.push('/(driver)/toilet-cabins'),
          } as TileItem,
        ]
      : []),
    { icon: FileText, label: 'Dokumenti', onPress: () => router.push('/(driver)/documents') },
    { icon: CalendarDays, label: 'Grafiks', onPress: () => router.push('/(driver)/schedule') },
    { icon: MessageCircle, label: 'Ziņojumi', onPress: () => router.push('/messages') },
    { icon: Bell, label: 'Paziņojumi', onPress: () => router.push('/notifications') },
  ];

  const settingsTiles: TileItem[] = [
    { icon: Settings, label: 'Iestatījumi', onPress: () => router.push('/settings') },
  ];

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Vairāk" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Main tiles */}
        <TileGrid tiles={mainTiles} />

        {/* Company — visible to owner / manager only */}
        {canManageTeam && (
          <>
            <Text style={s.sectionLabel}>UZŅĒMUMS</Text>
            <View style={s.listCard}>
              <ListRow
                icon={Building2}
                label="Uzņēmuma profils"
                onPress={() =>
                  Linking.openURL('https://b3hub.lv/dashboard/company').catch(() => null)
                }
              />
              <ListRow
                icon={Users}
                label="Komanda"
                last
                onPress={() =>
                  Linking.openURL('https://b3hub.lv/dashboard/company/team').catch(() => null)
                }
              />
            </View>
          </>
        )}

        {/* Settings */}
        <Text style={s.sectionLabel}>KONTS</Text>
        <TileGrid tiles={settingsTiles} />

        {/* Help */}
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
});
