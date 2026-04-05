import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
// Guard: expo-clipboard requires a native build (not available in Expo Go)
let Clipboard: { setStringAsync: (text: string) => Promise<void> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  Clipboard = require('expo-clipboard');
} catch {
  /* Expo Go fallback */
}
// Guard: @stripe/stripe-react-native requires a native build (not available in Expo Go)
let useStripe: (() => { initPaymentSheet: Function; presentPaymentSheet: Function }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch {
  /* Expo Go fallback */
}
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';
import { CheckCircle2, Copy } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

function formatDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OrderConfirmation() {
  const router = useRouter();
  const { state, reset } = useOrder();
  const order = state.confirmedOrder;
  const clientSecret = state.skipPaymentClientSecret;
  const stripe = useStripe?.();
  const [paying, setPaying] = useState(false);

  // ── Entrance animations ──────────────────────────────────────────────
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(24)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(32)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const btnsY = useRef(new Animated.Value(20)).current;
  const btnsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptics.success();
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 7,
        }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(240),
      Animated.parallel([
        Animated.spring(headerY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(560),
      Animated.parallel([
        Animated.spring(btnsY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.timing(btnsOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();
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
    { label: t.skipHire.confirmation.price, value: `€${order.price} ${order.currency}` },
  ];

  return (
    <ScreenContainer standalone bg="#fff">
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[s.iconWrap, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
        >
          <CheckCircle2 size={72} color="#111827" />
        </Animated.View>

        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerY }] }}>
          <Text style={s.title}>{t.skipHire.confirmation.title}</Text>
          <Text style={s.subtitle}>{t.skipHire.confirmation.subtitle}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardY }] }}>
          {/* Order number highlight card */}
          <TouchableOpacity
            style={s.orderNumCard}
            onPress={async () => {
              await Clipboard?.setStringAsync(order.orderNumber);
              haptics.success();
            }}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.orderNumLabel}>{t.skipHire.confirmation.orderNumber}</Text>
              <Text style={s.orderNum}>{order.orderNumber}</Text>
            </View>
            <Copy size={16} color="#6b7280" />
          </TouchableOpacity>

          {/* Order details */}
          <View style={s.detailsCard}>
            {details.map((row, i) => (
              <View key={i} style={[s.detailRow, i < details.length - 1 && s.detailRowBorder]}>
                <Text style={s.detailLabel}>{row.label}</Text>
                <Text style={s.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Status badge */}
          <View style={s.statusBadge}>
            <View style={s.statusDot} />
            <Text style={s.statusText}>
              {(
                {
                  PENDING: 'Gaida apstiprinājumu',
                  CONFIRMED: 'Apstiprināts',
                  IN_PROGRESS: 'Izpildē',
                  COMPLETED: 'Pabeigts',
                  CANCELLED: 'Atcelts',
                } as Record<string, string>
              )[order.status] ?? order.status}
            </Text>
          </View>
        </Animated.View>

        {/* CTA buttons */}
        <Animated.View style={{ opacity: btnsOpacity, transform: [{ translateY: btnsY }] }}>
          {/* Pay Now — shown when booking still awaiting payment */}
          {!!clientSecret && stripe && (
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: '#10b981', marginBottom: 10 }]}
              disabled={paying}
              onPress={async () => {
                setPaying(true);
                try {
                  const { error: initError } = await stripe.initPaymentSheet({
                    paymentIntentClientSecret: clientSecret,
                    merchantDisplayName: 'B3Hub',
                    returnURL: 'b3hub://order/confirmation',
                  });
                  if (initError) {
                    Alert.alert('Kļūda', initError.message);
                    return;
                  }
                  const { error: presentError } = await stripe.presentPaymentSheet();
                  if (presentError) {
                    if (presentError.code !== 'Canceled') {
                      Alert.alert('Maksājuma kļūda', presentError.message);
                    }
                  } else {
                    haptics.success();
                    Alert.alert('✓ Apmaksāts', 'Jūsu rezervācija ir apstiprināta.', [
                      {
                        text: 'Labi',
                        onPress: () => {
                          reset();
                          router.replace('/(buyer)/orders');
                        },
                      },
                    ]);
                  }
                } finally {
                  setPaying(false);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={s.primaryBtnText}>
                {paying ? 'Apstrādā…' : '💳 Apmaksāt pasūtījumu'}
              </Text>
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
              router.replace('/order');
            }}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryBtnText}>{t.skipHire.confirmation.newOrder}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { fontSize: 16, color: '#6b7280' },
  centerLink: { paddingVertical: 8 },
  centerLinkText: { color: '#111827', fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successIcon: { fontSize: 44 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  orderNumCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
  },
  orderNumLabel: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  orderNum: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
  },
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailLabel: { fontSize: 14, color: '#6b7280' },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    maxWidth: '55%',
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 32,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  statusText: { color: '#059669', fontWeight: '600', fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#111827',
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
    backgroundColor: '#f9fafb',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
