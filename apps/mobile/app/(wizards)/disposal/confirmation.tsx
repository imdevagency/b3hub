import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useDisposal } from '@/lib/disposal-context';
import {
  CheckCircle2,
  Recycle,
  MapPin,
  CalendarDays,
  Truck,
  CreditCard,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { formatDate } from '@/lib/format';

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
};

const TRUCK_LABELS: Record<string, string> = {
  TIPPER_SMALL: 'Pašizgāzējs (10 t)',
  TIPPER_LARGE: 'Pašizgāzējs lielais (18 t)',
  ARTICULATED_TIPPER: 'Sattelkipper (26 t)',
};

export default function DisposalConfirmation() {
  const router = useRouter();
  const { confirmedDisposal, reset } = useDisposal();

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

  // Fallback if context is not set (shouldn't happen in normal flow)
  if (!confirmedDisposal) {
    return (
      <ScreenContainer standalone bg="#fff">
        <View style={s.center}>
          <Text style={s.centerText}>Nav pieprasījuma informācijas.</Text>
          <TouchableOpacity
            onPress={() => {
              reset();
              router.replace('/(buyer)/home');
            }}
            style={s.centerLink}
          >
            <Text style={s.centerLinkText}>Atpakaļ uz sākumu</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const {
    jobNumber,
    pickupAddress,
    wasteType,
    wasteBreakdown,
    truckType,
    truckCount,
    requestedDate,
    fromPrice,
  } = confirmedDisposal;

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Icon */}
      <Animated.View
        style={[s.iconWrap, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
      >
        <View style={s.iconCircle}>
          <CheckCircle2 size={44} color="#22c55e" strokeWidth={1.5} />
        </View>
      </Animated.View>

      {/* Header */}
      <Animated.View
        style={[s.headerWrap, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}
      >
        <Text style={s.title}>Pieprasījums nosūtīts!</Text>
        <Text style={s.subtitle}>
          Mēs sazināsimies ar atkritumu savākšanas partneriem un atbildēsim jums pēc iespējas ātrāk.
        </Text>
        {jobNumber && jobNumber !== '—' && (
          <View style={s.refBadge}>
            <Recycle size={12} color="#059669" />
            <Text style={s.refText}>#{jobNumber}</Text>
          </View>
        )}
      </Animated.View>

      {/* Summary card */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        <Text style={s.cardTitle}>Pasūtījuma kopsavilkums</Text>

        {pickupAddress ? (
          <View style={s.row}>
            <MapPin size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Savākšanas adrese</Text>
              <Text style={s.rowValue}>{pickupAddress}</Text>
            </View>
          </View>
        ) : null}

        {wasteType ? (
          <View style={s.row}>
            <Recycle size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Atkritumu veids</Text>
              <Text style={s.rowValue}>
                {wasteBreakdown && wasteBreakdown.length > 1
                  ? wasteBreakdown.map((w) => WASTE_LABELS[w] ?? w).join(', ')
                  : (WASTE_LABELS[wasteType] ?? wasteType)}
              </Text>
            </View>
          </View>
        ) : null}

        {truckType ? (
          <View style={s.row}>
            <Truck size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Transports</Text>
              <Text style={s.rowValue}>
                {truckCount} × {TRUCK_LABELS[truckType] ?? truckType}
              </Text>
            </View>
          </View>
        ) : null}

        {requestedDate ? (
          <View style={s.row}>
            <CalendarDays size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Datums</Text>
              <Text style={s.rowValue}>{formatDate(requestedDate)}</Text>
            </View>
          </View>
        ) : null}

        {fromPrice != null && fromPrice > 0 ? (
          <View style={[s.row, { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}>
            <CreditCard size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Orientačjā cena</Text>
              <Text style={[s.rowValue, { color: colors.success, fontWeight: '600' }]}>
                no €{fromPrice} + PVN 21%
              </Text>
            </View>
          </View>
        ) : null}

        {/* Recycling center — assigned by platform after matching */}
        <View style={[s.row, { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}>
          <Recycle size={14} color="#6b7280" style={{ marginTop: 1 }} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.rowLabel}>Pārstrādes centrs</Text>
            <Text style={[s.rowValue, { color: colors.textMuted }]}>
              Tiks norīkots — jūs saņemsiet paziņojumu
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[s.btns, { opacity: btnsOpacity, transform: [{ translateY: btnsY }] }]}>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => {
            haptics.light();
            reset();
            router.replace('/(buyer)/orders');
          }}
          activeOpacity={0.85}
        >
          <Text style={s.btnPrimaryText}>Skatīt pasūtījumus</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnSecondary}
          onPress={() => {
            haptics.light();
            reset();
            router.replace('/(buyer)/home');
          }}
          activeOpacity={0.85}
        >
          <Text style={s.btnSecondaryText}>Uz sākumu</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginTop: 48, marginBottom: 24 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: { paddingHorizontal: 28, alignItems: 'center', marginBottom: 28 },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  refBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  card: {
    marginHorizontal: 20,
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { fontSize: 11, color: colors.textDisabled, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  btns: { paddingHorizontal: 20, gap: 10 },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSecondary: {
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerText: { fontSize: 16, color: colors.textMuted },
  centerLink: { paddingVertical: 8 },
  centerLinkText: { color: colors.textPrimary, fontWeight: '600' },
});
