import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
  Recycle,
} from 'lucide-react-native';

function ListRow({
  icon: Icon,
  label,
  onPress,
  isDestructive = false,
  last = false,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  last?: boolean;
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
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function RecyclerMoreScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = useLogoutConfirm();

  return (
    <ScreenContainer>
      <ScreenHeader title="Vairāk" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ls.scroll}>
        {/* profile banner */}
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
            <Text style={ls.bannerRole}>Reciklēšanas operators</Text>
            {user?.email && <Text style={ls.bannerEmail}>{user.email}</Text>}
          </View>
        </View>

        {/* nav section */}
        <View style={ls.section}>
          <Text style={ls.sectionLabel}>Konts</Text>
          <View style={ls.card}>
            <ListRow
              icon={User}
              label="Mans profils"
              onPress={() => router.push('/(shared)/settings')}
            />
            <ListRow
              icon={Building2}
              label="Uzņēmums"
              onPress={() => router.push('/(shared)/settings')}
            />
            <ListRow
              icon={Recycle}
              label="Reciklēšanas centrs"
              onPress={() => router.push('/(shared)/settings')}
              last
            />
          </View>
        </View>

        <View style={ls.section}>
          <Text style={ls.sectionLabel}>Iestatījumi</Text>
          <View style={ls.card}>
            <ListRow
              icon={Bell}
              label="Paziņojumi"
              onPress={() => router.push('/(shared)/settings')}
            />
            <ListRow
              icon={Settings}
              label="Iestatījumi"
              onPress={() => router.push('/(shared)/settings')}
              last
            />
          </View>
        </View>

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

        <View style={ls.section}>
          <View style={ls.card}>
            <ListRow icon={LogOut} label="Iziet" onPress={handleLogout} isDestructive last />
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
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerInfo: { flex: 1, gap: 2 },
  bannerName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  bannerRole: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  bannerEmail: { fontSize: 12, color: colors.textMuted },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 14, color: colors.textPrimary },
});
