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
  FileText,
  MessageCircle,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Building2,
  Users,
} from 'lucide-react-native';

export default function RecyclerMoreScreen() {
  const { user } = useAuth();
  useMode();
  const router = useRouter();

  const handleLogout = useLogoutConfirm();

  const canManageTeam =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    (user?.permManageTeam ?? false);

  const mainTiles: TileItem[] = [
    { icon: User, label: 'Profils', onPress: () => router.push('/(recycler)/profile') },
    { icon: FileText, label: 'Dokumenti', onPress: () => router.push('/(recycler)/documents') },
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

        {/* Company */}
        {canManageTeam && (
          <>
            <Text style={s.sectionLabel}>UZŅĒMUMS</Text>
            <View style={s.listCard}>
              <ListRow
                icon={Building2}
                label="Uzņēmuma portāls"
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
