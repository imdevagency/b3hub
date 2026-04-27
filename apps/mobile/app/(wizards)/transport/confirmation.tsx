import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle2,
  Truck,
  MapPin,
  CalendarDays,
  ArrowRight,
  Package,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { formatDate } from '@/lib/format';

const VEHICLE_LABELS: Record<string, string> = {
  TIPPER_SMALL: 'Mazais pašizgāzējs (5 t)',
  TIPPER_LARGE: 'Lielais pašizgāzējs (15 t)',
  ARTICULATED_TIPPER: 'Puspiekabe (26 t)',
  FLATBED: 'Platforma (20 t)',
  BOX_TRUCK: 'Kravas furgons (3.5 t)',
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
    cargo,
    estimatedPrice,
  } = useLocalSearchParams<{
    jobNumber: string;
    pickupAddress: string;
    pickupCity: string;
    dropoffAddress: string;
    dropoffCity: string;
    vehicleType: string;
    requestedDate: string;
    cargo: string;
    estimatedPrice: string;
  }>();

  useEffect(() => {
    haptics.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!jobNumber) {
    router.replace('/(buyer)/home');
    return null;
  }

  const pickupDisplay = [pickupAddress, pickupCity].filter(Boolean).join(', ');
  const dropoffDisplay = [dropoffAddress, dropoffCity].filter(Boolean).join(', ');

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Icon */}
      <View style={s.iconWrap}>
        <View style={s.iconCircle}>
          <CheckCircle2 size={44} color="#22c55e" strokeWidth={1.5} />
        </View>
      </View>

      {/* Header */}
      <View style={s.headerWrap}>
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
      </View>

      {/* Summary card */}
      <View style={s.card}>
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

        {cargo && cargo !== '—' ? (
          <View style={s.row}>
            <Package size={14} color="#6b7280" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.rowLabel}>Krava</Text>
              <Text style={s.rowValue}>{cargo}</Text>
            </View>
          </View>
        ) : null}

        {estimatedPrice ? (
          <View style={s.estimatedRow}>
            <Text style={s.estimatedLabel}>Orientējošā cena</Text>
            <Text style={s.estimatedValue}>{estimatedPrice}</Text>
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
      </View>

      {/* Buttons */}
      <View style={s.btns}>
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
      </View>
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
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 },
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
    backgroundColor: colors.primary,
    marginTop: 4,
    flexShrink: 0,
  },
  routeDotDest: {
    backgroundColor: '#2563eb',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowLabel: { fontSize: 11, color: colors.textDisabled, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  estimatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  estimatedLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  estimatedValue: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },

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
});
