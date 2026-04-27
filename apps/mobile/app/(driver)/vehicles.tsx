/**
 * (driver)/vehicles.tsx
 *
 * Read-only fleet view for mobile drivers.
 *
 * Rationale: adding vehicles (insurance expiry dates, inspection expiry dates,
 * make/model/year/capacity) is a fleet-manager back-office task. Drivers on
 * mobile only need to see which trucks are registered and whether they're active.
 * Full CRUD is on the web portal at /dashboard/fleet-management.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiVehicle, type VehicleType } from '@/lib/api';
import { Truck, ExternalLink } from 'lucide-react-native';
import { colors } from '@/lib/theme';

const WEB_FLEET_URL = 'https://b3hub.lv/dashboard/fleet-management';

const VEHICLE_LABELS: Record<VehicleType, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Vilcējs ar puspiekabi',
  HOOK_LIFT: 'Āķa pacēlājs',
  SKIP_LOADER: 'Konteinerauto',
  TANKER: 'Cisternauto',
  VAN: 'Furgons',
};

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryLine({ label, iso }: { label: string; iso: string | null | undefined }) {
  const d = daysUntil(iso);
  if (d === null) return null;
  const warn = d <= 30;
  const expired = d < 0;
  return (
    <Text
      style={[
        s.expiry,
        warn && { color: '#b45309' },
        expired && { color: '#b91c1c', fontWeight: '600' },
      ]}
    >
      {label}:{' '}
      {expired
        ? `beidzies pirms ${Math.abs(d)} d.`
        : d === 0
          ? 'beidzas šodien'
          : `beidzas pēc ${d} d.`}
    </Text>
  );
}

function VehicleRow({ vehicle }: { vehicle: ApiVehicle }) {
  const typeLabel = VEHICLE_LABELS[vehicle.vehicleType] ?? vehicle.vehicleType;

  return (
    <View style={s.row}>
      <View style={s.iconWrap}>
        <Truck size={22} color="#1d4ed8" strokeWidth={1.8} />
      </View>

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.plate}>{vehicle.licensePlate}</Text>
          <StatusPill
            label={vehicle.isActive ? 'Aktīvs' : 'Neaktīvs'}
            bg={vehicle.isActive ? '#dcfce7' : '#f3f4f6'}
            color={vehicle.isActive ? '#166534' : '#6b7280'}
            size="sm"
          />
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {typeLabel}
          {vehicle.make || vehicle.model
            ? ` · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`
            : ''}
          {vehicle.year ? ` · ${vehicle.year}` : ''}
          {typeof vehicle.capacity === 'number' ? ` · ${vehicle.capacity}t` : ''}
        </Text>
        <ExpiryLine label="OCTA" iso={vehicle.insuranceExpiry} />
        <ExpiryLine label="TA" iso={vehicle.inspectionExpiry} />
      </View>
    </View>
  );
}

export default function DriverVehiclesScreen() {
  const { token } = useAuth();
  const toast = useToast();

  const [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVehicles = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const data = await api.vehicles.getAll(token);
        setVehicles(data);
      } catch {
        toast.error('Neizdevās ielādēt transportlīdzekļus');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, toast],
  );

  useFocusEffect(
    useCallback(() => {
      fetchVehicles('initial');
    }, [fetchVehicles]),
  );

  const openWeb = useCallback(async () => {
    haptics.light();
    const supported = await Linking.canOpenURL(WEB_FLEET_URL);
    if (supported) {
      Linking.openURL(WEB_FLEET_URL);
    } else {
      Alert.alert('Atveriet b3hub.lv pārlūkā', WEB_FLEET_URL);
    }
  }, []);

  return (
    <ScreenContainer bg="white">
      <ScreenHeader title="Transportlīdzekļi" />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchVehicles('refresh')}
            tintColor={colors.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Flotes pārvaldība notiek tīmeklī</Text>
          <Text style={s.bannerSub}>
            Lai pievienotu vai rediģētu transportlīdzekļus, OCTA un TA termiņus, izmantojiet portālu
            b3hub.lv.
          </Text>
          <TouchableOpacity style={s.bannerBtn} onPress={openWeb} activeOpacity={0.85}>
            <Text style={s.bannerBtnText}>Atvērt portālu</Text>
            <ExternalLink size={14} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.list}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck size={32} color={colors.textMuted} strokeWidth={1.5} />}
            title="Nav transportlīdzekļu"
            subtitle="Jūsu flotei vēl nav pievienotu transportlīdzekļu. Pievienojiet tos tīmekļa portālā."
          />
        ) : (
          <View style={s.list}>
            {vehicles.map((v) => (
              <VehicleRow key={v.id} vehicle={v} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  list: {
    paddingHorizontal: 20,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  plate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  expiry: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
});
