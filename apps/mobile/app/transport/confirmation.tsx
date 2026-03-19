import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Truck, MapPin, CalendarDays, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

const VEHICLE_LABELS: Record<string, string> = {
  TIPPER_SMALL: 'Pašizgāzējs (10 t)',
  TIPPER_LARGE: 'Pašizgāzējs lielais (18 t)',
  ARTICULATED_TIPPER: 'Sattelkipper (26 t)',
};

export default function TransportConfirmation() {
  const router = useRouter();
  const {
    jobNumber,
    pickupAddress,
    pickupCity,
    dropoffAddress,
    dropoffCity,
    vehicleType,
    requestedDate,
  } = useLocalSearchParams<{
    jobNumber: string;
    pickupAddress: string;
    pickupCity: string;
    dropoffAddress: string;
    dropoffCity: string;
    vehicleType: string;
    requestedDate: string;
  }>();

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

  const pickupDisplay = [pickupAddress, pickupCity].filter(Boolean).join(', ');
  const dropoffDisplay = [dropoffAddress, dropoffCity].filter(Boolean).join(', ');

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
          Meklējam piemērotāko pārvadātāju. Jūs saņemsiet paziņojumu, kad brauciens tiks
          apstiprināts.
        </Text>
        {jobNumber && jobNumber !== '—' && (
          <View style={s.refBadge}>
            <Truck size={12} color="#2563eb" />
            <Text style={s.refText}>#{jobNumber}</Text>
          </View>
        )}
      </Animated.View>

      {/* Summary card */}
      <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        <Text style={s.cardTitle}>Maršruta kopsavilkums</Text>

        {/* Route display */}
        {pickupDisplay || dropoffDisplay ? (
          <View style={s.routeRow}>
            <View style={s.routeCol}>
              <View style={s.routeDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Iekraušana</Text>
                <Text style={s.rowValue} numberOfLines={2}>
                  {pickupDisplay || '—'}
                </Text>
              </View>
            </View>
            <ArrowRight size={16} color="#9ca3af" style={{ marginHorizontal: 4 }} />
            <View style={s.routeCol}>
              <View style={[s.routeDot, s.routeDotDest]} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Izkraušana</Text>
                <Text style={s.rowValue} numberOfLines={2}>
                  {dropoffDisplay || '—'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {vehicleType ? (
          <View style={s.row}>
            <Truck size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Transportlīdzeklis</Text>
              <Text style={s.rowValue}>{VEHICLE_LABELS[vehicleType] ?? vehicleType}</Text>
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
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[s.btns, { opacity: btnsOpacity, transform: [{ translateY: btnsY }] }]}>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => {
            haptics.light();
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
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  refBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  refText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },

  card: {
    marginHorizontal: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  routeCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    marginTop: 4,
    flexShrink: 0,
  },
  routeDotDest: {
    backgroundColor: '#2563eb',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: '#111827' },

  btns: { paddingHorizontal: 20, gap: 10 },
  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
});
