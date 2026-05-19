/**
 * Messages tab — Bilt Communications.
 *
 * All contact goes through Bilt. There is no direct peer-to-peer messaging
 * between buyers, sellers, carriers, and drivers (Schüttflix "Smooth Contacts"
 * model). This screen is the entry point to Bilt Support.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { MessageCircle, PhoneCall, HelpCircle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { colors, spacing, radius } from '@/lib/theme';
import { t } from '@/lib/translations';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const homeRoute = user?.canTransport
    ? '/(driver)/home'
    : user?.canSell
      ? '/(seller)/home'
      : '/(buyer)/home';

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace(homeRoute));

  return (
    <ScreenContainer bg="#ffffff" noAnimation>
      <ScreenHeader title={t.nav.messages} onBack={handleBack} noBorder />

      <View style={s.body}>
        {/* Icon */}
        <View style={s.iconWrap}>
          <MessageCircle size={32} color={colors.primary} strokeWidth={1.5} />
        </View>

        {/* Heading */}
        <Text style={s.heading}>Bilt Atbalsts</Text>

        {/* Description */}
        <Text style={s.desc}>
          Visi jautājumi par pasūtījumiem, piegādēm un norēķiniem tiek risināti caur Bilt. Mēs esam
          jūsu vienīgais kontakts — bez liekiem zvaniem uz būvlaukumu.
        </Text>

        {/* Primary CTA */}
        <TouchableOpacity
          style={s.primaryBtn}
          activeOpacity={0.8}
          onPress={() => router.push('/(shared)/support-chat' as any)}
        >
          <MessageCircle size={18} color="#fff" strokeWidth={2} />
          <Text style={s.primaryBtnText}>Rakstīt Bilt atbalstam</Text>
        </TouchableOpacity>

        {/* Secondary links */}
        <View style={s.linkRow}>
          <TouchableOpacity
            style={s.linkBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/(shared)/help' as any)}
          >
            <HelpCircle size={16} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={s.linkText}>Palīdzība</Text>
          </TouchableOpacity>
        </View>

        {/* Info strip */}
        <View style={s.infoStrip}>
          <Text style={s.infoText}>
            Bilt ir jūsu līgumpartneris — ne pircējs, ne pārdevējs, ne autovadītājs. Visas sarunas
            paliek platformā un ir dokumentētas.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  desc: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoStrip: {
    backgroundColor: '#f9fafb',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
