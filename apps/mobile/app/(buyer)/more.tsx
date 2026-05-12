import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Pressable,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ListRow } from '@/components/ui/ListRow';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { haptics } from '@/lib/haptics';
import { useLogoutConfirm } from '@/lib/use-logout-confirm';
import { useRequireAuth } from '@/lib/use-require-auth';
import { colors } from '@/lib/theme';

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
  LogOut,
  Building2,
  HardHat,
  Recycle,
  CreditCard,
  ChevronRight,
} from 'lucide-react-native';

const MARKET_PARTIES = [
  { key: 'constructor', label: 'Celtnieks', icon: HardHat },
  { key: 'freight', label: 'Pārvadājumi', icon: Truck },
  { key: 'supplier', label: 'Piegādātājs', icon: Package },
  { key: 'recycler', label: 'Pārstrādātājs', icon: Recycle },
] as const;

export default function MoreScreen() {
  const { user, isLoading } = useAuth();
  useMode();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const handleLogout = useLogoutConfirm();

  const isBusinessUser = !!(user?.isCompany || user?.company?.id);

  // Uber-style quick actions row (top row under profile)
  const quickActions = [
    { icon: HelpCircle, label: 'Palīdzība', onPress: () => router.push('/help') },
    {
      icon: CreditCard,
      label: 'Maksājumi',
      onPress: requireAuth(() => router.push('/(buyer)/(account)/payment-methods')),
    },
    {
      icon: MessageCircle,
      label: 'Ziņojumi',
      onPress: requireAuth(() => router.push('/messages')),
    },
  ];

  return (
    <ScreenContainer noAnimation bg={colors.bgScreen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Header / Profile block ── */}
        <View style={s.headerBlock}>
          {isLoading ? null : user ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={s.profileRow}
              onPress={() => router.push('/(buyer)/profile')}
            >
              <View style={s.profileTextCol}>
                <Text style={s.profileName} numberOfLines={1}>
                  {user.email?.split('@')[0] || 'Lietotājs'}
                </Text>
                <View style={s.ratingBadge}>
                  <Text style={s.ratingText}>
                    {isBusinessUser ? 'Uzņēmuma konts' : 'Privātpersona'}
                  </Text>
                </View>
              </View>
              <View style={s.profileAvatarWrap}>
                <AvatarImage initials={(user.email?.[0] || 'U').toUpperCase()} size={64} />
                <ChevronRight size={24} color={colors.textDisabled} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={s.guestHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.guestWelcome}>Sveiki!</Text>
                <Text style={s.guestSub}>Pievienojies B3Hub, lai veiktu pasūtījumus</Text>
              </View>
              <View style={s.guestAvatarSub}>
                <User size={32} color={colors.textDisabled} />
              </View>
            </View>
          )}
        </View>

        {/* ── Quick Actions Row ── */}
        <View style={s.quickActionsWrap}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={s.quickActionCard}
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                action.onPress();
              }}
            >
              <action.icon size={28} color={colors.textPrimary} strokeWidth={1.5} />
              <Text style={s.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Marketing Hero for Guests ── */}
        {!isLoading && !user && (
          <View style={s.heroCard}>
            <Text style={s.heroTagline}>PLATFORMA</Text>
            <Text style={s.heroHeading}>
              Viena digitāla platforma visai celtniecības loģistikai.
            </Text>
            <Text style={s.heroSub}>
              Pasūtiet materiālus, pārdodiet no karjera vai vediet kravas — platforma darbojas visām
              četrām pusēm vienlaikus.
            </Text>
            <View style={s.partyGrid}>
              {MARKET_PARTIES.map((p) => (
                <View key={p.key} style={s.partyChip}>
                  <View style={s.partyIconWrap}>
                    <p.icon size={20} color={colors.primary} strokeWidth={1.7} />
                  </View>
                  <Text style={s.partyLabel}>{p.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Standard Lists ── */}

        {user && (
          <View style={s.listGroup}>
            <ListRow
              icon={MapPin}
              label="Saglabātās adreses"
              onPress={() => router.push('/(buyer)/(account)/saved-addresses')}
            />
            <ListRow
              icon={FileText}
              label="Dokumenti un rēķini"
              onPress={() => router.push('/(buyer)/(account)/documents')}
            />
            <ListRow
              icon={AlertCircle}
              label="Strīdi"
              onPress={() => router.push('/(buyer)/(account)/disputes')}
            />
            <ListRow
              icon={Bell}
              label="Paziņojumi"
              onPress={() => router.push('/notifications')}
              last
            />
          </View>
        )}

        {isBusinessUser && (
          <>
            <Text style={s.sectionTitle}>Uzņēmums</Text>
            <View style={s.listGroup}>
              <ListRow
                icon={Building2}
                label="Mans uzņēmums"
                onPress={() =>
                  Linking.openURL('https://b3hub.lv/dashboard/company').catch(() => null)
                }
              />
              <ListRow
                icon={BarChart2}
                label="Analītika"
                onPress={() =>
                  Linking.openURL('https://b3hub.lv/dashboard/analytics').catch(() => null)
                }
              />
              <ListRow
                icon={Calendar}
                label="Grafiki"
                onPress={() => router.push('/(buyer)/(account)/schedules')}
              />
              <ListRow
                icon={FileText}
                label="Rāmjlīgumi"
                onPress={() => router.push('/(buyer)/framework-contracts')}
                last
              />
            </View>
          </>
        )}

        {user && (!user.canSell || !user.canTransport) && (
          <>
            <Text style={s.sectionTitle}>Kļūt par partneri</Text>
            <View style={s.listGroup}>
              {!user.canSell && (
                <ListRow
                  icon={Package}
                  label="Kļūt par piegādātāju"
                  onPress={() => router.push('/(auth)/apply-role?type=supplier' as never)}
                  last={user.canTransport}
                />
              )}
              {!user.canTransport && (
                <ListRow
                  icon={Truck}
                  label="Kļūt par pārvadātāju"
                  onPress={() => router.push('/(auth)/apply-role?type=carrier' as never)}
                  last
                />
              )}
            </View>
          </>
        )}

        <Text style={s.sectionTitle}>Iestatījumi</Text>
        <View style={s.listGroup}>
          <ListRow
            icon={Settings}
            label="Lietotnes iestatījumi"
            onPress={() => router.push('/settings')}
          />
          <ListRow
            icon={MessageCircle}
            label="Atbalsta čats"
            onPress={() => router.push('/support-chat' as never)}
            last={!user}
          />
          {user && (
            <ListRow
              icon={LogOut}
              label="Iziet no konta"
              isDestructive
              onPress={handleLogout}
              last
            />
          )}
        </View>

        {!user && (
          <View style={s.guestActions}>
            <TouchableOpacity
              style={s.guestPrimary}
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register' as never);
              }}
            >
              <Text style={s.guestPrimaryText}>Reģistrēties</Text>
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

        <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
    paddingTop: 16,
  },

  // Header
  headerBlock: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  profileAvatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 6,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestWelcome: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  guestSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 22,
  },
  guestAvatarSub: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },

  // Quick actions
  quickActionsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  quickActionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Lists
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  listGroup: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },

  // Marketing hero
  heroCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 20,
  },
  heroTagline: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroHeading: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 18,
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  partyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.bgSubtle,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  partyIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Guest actions
  guestActions: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  guestPrimary: {
    backgroundColor: '#111827',
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
