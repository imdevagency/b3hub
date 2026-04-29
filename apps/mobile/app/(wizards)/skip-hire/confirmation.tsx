import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
// Guard: expo-clipboard requires a native build (not available in Expo Go)
let Clipboard: { setStringAsync: (text: string) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  Clipboard = require('expo-clipboard');
} catch {
  /* Expo Go fallback */
}
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'expo-router';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';
import { CheckCircle2, Copy } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

function formatDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrderConfirmation() {
  const toast = useToast();
  const router = useRouter();
  const { state, reset } = useOrder();
  const order = state.confirmedOrder;
  const paymentUrl = state.skipPaymentUrl;
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    haptics.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!order) {
    return (
      <ScreenContainer standalone bg="#fff">
        <View style={s.center}>
          <Text style={s.centerText}>Nav pasūtījuma.</Text>
          <TouchableOpacity onPress={() => router.replace('/(buyer)/home')} style={s.centerLink}>
            <Text style={s.centerLinkText}>Atpakaļ uz sākumu</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const wasteInfo = t.skipHire.step2.types[order.wasteCategory];
  const sizeInfo = t.skipHire.step3.sizes[order.skipSize];
  const wasteLabel = wasteInfo?.label ?? order.wasteCategory;
  const sizeLabel = sizeInfo ? `${sizeInfo.label} (${sizeInfo.volume})` : order.skipSize;

  const details = [
    { label: t.skipHire.confirmation.location, value: order.location },
    { label: t.skipHire.confirmation.size, value: sizeLabel },
    { label: t.skipHire.confirmation.wasteType, value: wasteLabel },
    { label: t.skipHire.confirmation.deliveryDate, value: formatDisplay(order.deliveryDate) },
    ...(order.hireDays ? [{ label: 'Nomas periods', value: `${order.hireDays} dienas` }] : []),
    {
      label: 'Maksājums',
      value:
        order.paymentMethod === 'INVOICE' ? 'Rēķins (bankas pārskaitījums)' : 'Karte (Paysera)',
    },
    { label: t.skipHire.confirmation.price, value: `€${order.price} ${order.currency}` },
  ];

  return (
    <ScreenContainer standalone bg="#fff">
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={[{ opacity: 1 }, s.iconWrap]}>
          <View style={s.successCircle}>
            <CheckCircle2 size={40} color="#059669" strokeWidth={2.5} />
          </View>
        </View>

        <View>
          <Text style={s.title}>{t.skipHire.confirmation.title}</Text>
          <Text style={s.subtitle}>{t.skipHire.confirmation.subtitle}</Text>

          <TouchableOpacity
            style={s.minimalOrderRow}
            onPress={async () => {
              await Clipboard?.setStringAsync(order.orderNumber);
              haptics.success();
            }}
            activeOpacity={0.6}
          >
            <Text style={s.minimalOrderText}>Pasūtījums: {order.orderNumber}</Text>
            <Copy size={14} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View>
          {/* Minimal details list without heavy background or borders */}
          <View style={s.minimalDetails}>
            {details.map((row, i) => (
              <View key={i} style={s.detailRow}>
                <Text style={s.detailLabel}>{row.label}</Text>
                <Text style={s.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* What happens next */}
          <View style={s.nextStepsCard}>
            <Text style={s.nextStepsTitle}>Kas notiks tālāk?</Text>
            <View style={s.nextStep}>
              <Text style={s.nextStepNum}>1</Text>
              <Text style={s.nextStepText}>
                Mēs piešķirsim pārvadātāju jūsu pasūtījumam (parasti 1–2 darba stundu laikā).
              </Text>
            </View>
            <View style={s.nextStep}>
              <Text style={s.nextStepNum}>2</Text>
              <Text style={s.nextStepText}>
                Jūs saņemsiet paziņojumu, kad konteiners tiks piegādāts norādītajā adresē.
              </Text>
            </View>
            <View style={s.nextStep}>
              <Text style={s.nextStepNum}>3</Text>
              <Text style={s.nextStepText}>
                Pēc nomas perioda beigām pārvadātājs savāks konteineru. Sekojiet statusam sadaļā
                "Pasūtījumi".
              </Text>
            </View>
          </View>
        </View>

        {/* CTA buttons */}
        <View>
          {/* Pay Now — shown when booking still awaiting payment */}
          {!!paymentUrl && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: '#10b981', marginBottom: 10 }]}
              disabled={paying}
              onPress={async () => {
                setPaying(true);
                try {
                  const supported = await Linking.canOpenURL(paymentUrl);
                  if (!supported) {
                    toast.error('Nevar atvērt maksājuma lapu');
                    return;
                  }
                  await Linking.openURL(paymentUrl);
                  // Webhook will mark the order as paid; user will see updated status on return
                  reset();
                  router.replace('/(buyer)/orders');
                } catch (err: unknown) {
                  Alert.alert(
                    'Maksājuma kļūda',
                    err instanceof Error ? err.message : 'Neizdevās atvērt Paysera',
                  );
                } finally {
                  setPaying(false);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={s.primaryBtnText}>{paying ? 'Atver...' : '💳 Apmaksāt pasūtījumu'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              haptics.medium();
              reset();
              router.replace('/(buyer)/orders');
            }}
            activeOpacity={0.8}
          >
            <Text style={s.primaryBtnText}>{t.skipHire.confirmation.viewMyOrders}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => {
              haptics.light();
              reset();
              router.replace('/skip-hire');
            }}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryBtnText}>{t.skipHire.confirmation.newOrder}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { fontSize: 16, color: colors.textMuted },
  centerLink: { paddingVertical: 8 },
  centerLinkText: { color: colors.textPrimary, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  minimalOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    marginBottom: 40,
  },
  minimalOrderText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  minimalDetails: {
    gap: 20,
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 15,
    color: colors.textMuted,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  nextStepsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 14,
  },
  nextStepsTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  nextStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  nextStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#166534',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    lineHeight: 22,
    flexShrink: 0,
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
});
