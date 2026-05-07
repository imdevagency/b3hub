import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useLogoutConfirm } from '@/lib/use-logout-confirm';
import { colors } from '@/lib/theme';
import {
  User,
  Bell,
  Settings,
  HelpCircle,
  ChevronRight,
  LogOut,
  Building2,
  HardHat,
  TrendingUp,
  Users,
  ExternalLink,
} from 'lucide-react-native';

function ListRow({
  icon: Icon,
  label,
  onPress,
  isDestructive = false,
  last = false,
  external = false,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  last?: boolean;
  external?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[ls.row, last && ls.rowLast]}
      activeOpacity={0.8}
      onPress={() => {
        haptics.light();
        onPress();
      }}
    >
      <View style={ls.rowLeft}>
        <Icon size={18} color={isDestructive ? colors.dangerText : colors.textSecondary} />
        <Text style={[ls.rowLabel, isDestructive && { color: colors.dangerText }]}>{label}</Text>
      </View>
      {external ? (
        <ExternalLink size={14} color={colors.textMuted} />
      ) : (
        <ChevronRight size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function ConstructionMoreScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const handleLogout = useLogoutConfirm();
  const openWeb = (path: string) =>
    Linking.openURL(`https://b3hub.lv/dashboard/construction${path}`).catch(() => null);

  return (
    <ScreenContainer>
      <ScreenHeader title="Vairāk" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ls.scroll}>
        {/* Profile banner */}
        <View style={ls.banner}>
          <View style={ls.avatar}>
            <Text style={ls.avatarText}>
              {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
            </Text>
          </View>
          <View style={ls.bannerInfo}>
            <Text style={ls.bannerName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={ls.bannerRole}>Celtniecības ERP</Text>
            {user?.email && <Text style={ls.bannerEmail}>{user.email}</Text>}
          </View>
        </View>

        {/* ERP web links */}
        <View style={ls.section}>
          <Text style={ls.sectionLabel}>ERP portāls</Text>
          <View style={ls.card}>
            <ListRow
              icon={TrendingUp}
              label="Rentabilitāte"
              onPress={() => openWeb('/profitability')}
              external
            />
            <ListRow
              icon={Users}
              label="Darbinieki"
              onPress={() => openWeb('/employees')}
              external
            />
            <ListRow
              icon={Users}
              label="Apakšuzņēmēji"
              onPress={() => openWeb('/subcontractors')}
              external
            />
            <ListRow
              icon={Building2}
              label="Klienti"
              onPress={() => openWeb('/clients')}
              external
              last
            />
          </View>
        </View>

        {/* Account */}
        <View style={ls.section}>
          <Text style={ls.sectionLabel}>Konts</Text>
          <View style={ls.card}>
            <ListRow
              icon={User}
              label="Mans profils"
              onPress={() => router.push('/(shared)/settings')}
            />
            <ListRow icon={HardHat} label="Uzņēmums" onPress={() => openWeb('')} external last />
          </View>
        </View>

        {/* Settings */}
        <View style={ls.section}>
          <Text style={ls.sectionLabel}>Iestatījumi</Text>
          <View style={ls.card}>
            <ListRow
              icon={Bell}
              label="Paziņojumi"
              onPress={() => router.push('/(shared)/notifications')}
            />
            <ListRow
              icon={Settings}
              label="Iestatījumi"
              onPress={() => router.push('/(shared)/settings')}
              last
            />
          </View>
        </View>

        {/* Support */}
        <View style={ls.section}>
          <Text style={ls.sectionLabel}>Atbalsts</Text>
          <View style={ls.card}>
            <ListRow
              icon={HelpCircle}
              label="Palīdzība"
              onPress={() => router.push('/(shared)/help')}
              last
            />
          </View>
        </View>

        {/* Logout */}
        <View style={ls.section}>
          <View style={ls.card}>
            <ListRow icon={LogOut} label="Izrakstīties" onPress={handleLogout} isDestructive last />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerInfo: { flex: 1 },
  bannerName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  bannerRole: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  bannerEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15, color: '#111827' },
});
