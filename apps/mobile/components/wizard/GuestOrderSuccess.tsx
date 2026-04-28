/**
 * GuestOrderSuccess — full-screen inline confirmation shown after a guest
 * (no-account) submission. Used by all four wizards (material, skip-hire,
 * transport, disposal).
 *
 * Shows:
 *   • Order number + "we'll be in touch" message
 *   • Optional email confirmation note
 *   • "Create account" upsell card
 *   • "Back to home" CTA
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, UserPlus } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { addGuestOrder } from '@/lib/guest-token-storage';

interface Props {
  orderNumber: string;
  contactEmail?: string;
  onBack?: () => void;
  /** Public tracking token — if provided, the order is persisted to AsyncStorage
   *  so it remains visible in the "Aktivitāte" tab after the wizard is closed. */
  guestToken?: string;
  /** Order category used for display in the orders list. */
  category?: string;
}

export function GuestOrderSuccess({
  orderNumber,
  contactEmail,
  onBack,
  guestToken,
  category,
}: Props) {
  const router = useRouter();

  // Persist the guest order token so it stays visible in the orders tab
  useEffect(() => {
    if (!guestToken) return;
    addGuestOrder({
      token: guestToken,
      orderNumber,
      category: category ?? 'MATERIAL',
      createdAt: Date.now(),
    });
  }, [guestToken, orderNumber, category]);

  const handleBack = onBack ?? (() => router.replace('/(buyer)/home' as never));
  // Pass guestToken so the register screen can surface the order after sign-up
  const handleCreateAccount = () =>
    router.push(
      (guestToken
        ? `/(auth)/register?guestToken=${encodeURIComponent(guestToken)}`
        : '/(auth)/register') as never,
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ScrollView contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>
        {/* Icon + title */}
        <View style={s.iconBg}>
          <CheckCircle2 size={40} color="#fff" />
        </View>
        <Text style={s.title}>Paldies! Pasūtījums saņemts.</Text>
        <Text style={s.orderNum}>Nr. {orderNumber}</Text>
        <Text style={s.sub}>
          Mūsu komanda ar jums sazināsies tuvākajā laikā, lai apstiprinātu cenu un detaļas.
          {contactEmail ? `\n\nApstiprinājums nosūtīts uz ${contactEmail}.` : ''}
        </Text>

        {/* "Create account" upsell */}
        <View style={s.upsellCard}>
          <UserPlus size={20} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text style={s.upsellTitle}>Sekojiet pasūtījumam ar kontu</Text>
          <Text style={s.upsellSub}>
            Izveidojiet kontu, lai reāllaikā sekotu savam pasūtījumam, saņemtu rēķinus un saglabātu
            adreses nākamajiem pasūtījumiem.
          </Text>
          <TouchableOpacity style={s.upsellBtn} onPress={handleCreateAccount} activeOpacity={0.85}>
            <Text style={s.upsellBtnLabel}>Izveidot kontu</Text>
          </TouchableOpacity>
        </View>

        {/* Back CTA */}
        <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Text style={s.backBtnLabel}>Atgriezties uz sākumu</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingBottom: 48,
    backgroundColor: colors.bgScreen,
  },
  iconBg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  orderNum: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
    marginBottom: 16,
  },
  sub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  upsellCard: {
    width: '100%',
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  upsellTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  upsellSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  upsellBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  upsellBtnLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  backBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
  },
});
