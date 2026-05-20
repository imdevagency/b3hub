/**
 * Driver pre-accept job detail screen.
 * Shows route map, cargo details, and Accept CTA before a driver commits.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Package, Truck, Calendar, Ruler, Weight } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
import { BaseMap } from '@/components/map/BaseMap';
import { RouteLayer } from '@/components/map/layers/RouteLayer';
import { PinLayer } from '@/components/map/layers/PinLayer';
import { useRoute } from '@/components/map/hooks/useRoute';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob } from '@/lib/api';
import { haptics } from '@/lib/haptics';

const VEHICLE_LABEL: Record<string, string> = {
  DUMP_TRUCK_10T: 'Pašizgāzējs (10 t)',
  DUMP_TRUCK_18T: 'Pašizgāzējs (18 t)',
  DUMP_TRUCK_26T: 'Pašizgāzējs (26 t)',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Vilcējs ar puspiekabi',
  SKIP_LOADER: 'Konteinerauto',
  TANKER: 'Cisternauto',
  // legacy fallbacks
  TIPPER_SMALL: 'Pašizgāzējs (10 t)',
  TIPPER_LARGE: 'Pašizgāzējs (18 t)',
  ARTICULATED_TIPPER: 'Pašizgāzējs (26 t)',
  FLATBED: 'Platforma',
  TIPPER_10T: 'Pašizgāzējs 10t',
  TIPPER_20T: 'Pašizgāzējs 20t',
  TIPPER_25T: 'Pašizgāzējs 25t',
};

const CARGO_LABEL: Record<string, string> = {
  GRAVEL: 'Grants',
  SAND: 'Smiltis',
  SOIL: 'Augsne',
  RUBBLE: 'Būvgruži',
  MIXED: 'Jauktas',
  OTHER: 'Cits',
};

export default function DriverJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const pickup =
    job?.pickupLat && job?.pickupLng ? { lat: job.pickupLat, lng: job.pickupLng } : null;
  const delivery =
    job?.deliveryLat && job?.deliveryLng ? { lat: job.deliveryLat, lng: job.deliveryLng } : null;

  const { route } = useRoute(pickup, delivery);

  useEffect(() => {
    if (!id || !token) return;
    api.transportJobs
      .getOne(id, token)
      .then(setJob)
      .catch(() => {
        Alert.alert('Kļūda', 'Neizdevās ielādēt darbu');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleAccept = async () => {
    if (!job || !token) return;
    haptics.medium();
    setAccepting(true);
    try {
      await api.transportJobs.accept(job.id, token);
      haptics.success();
      router.replace({
        pathname: '/(driver)/schedule-arrival' as never,
        params: { jobId: job.id, pickupDate: job.pickupDate ?? '' },
      } as never);
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās pieņemt darbu. Mēģini vēlreiz.');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="white">
        <ScreenHeader title="Darbs" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </ScreenContainer>
    );
  }

  if (!job) return null;

  const pickupDate = job.pickupDate
    ? new Date(job.pickupDate).toLocaleDateString('lv-LV', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  const jobTypeLabel =
    job.jobType === 'WASTE_COLLECTION'
      ? 'Utilizācija'
      : job.jobType === 'MATERIAL_DELIVERY'
        ? 'Piegāde'
        : 'Transports';

  const vehicleLabel =
    VEHICLE_LABEL[job.requiredVehicleEnum ?? job.requiredVehicleType ?? ''] ??
    job.requiredVehicleType ??
    '—';

  return (
    <ScreenContainer bg="white">
      <ScreenHeader title={`Darbs #${job.jobNumber}`} />

      {/* Map preview */}
      <View style={styles.mapWrapper}>
        <BaseMap
          style={styles.map}
          center={pickup ? [pickup.lng, pickup.lat] : undefined}
          zoom={10}
        >
          {route?.coords && route.coords.length > 0 && (
            <RouteLayer id="route" coordinates={route.coords} />
          )}
          {pickup && (
            <PinLayer id="pickup" coordinate={pickup} type="elegant-pickup" label="Paņemšana" />
          )}
          {delivery && (
            <PinLayer id="delivery" coordinate={delivery} type="elegant-delivery" label="Piegāde" />
          )}
        </BaseMap>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Job type badge */}
        <View style={styles.badgeRow}>
          <StatusPill label={jobTypeLabel} bg="#111827" color="#fff" size="sm" />
          {job.distanceKm && (
            <StatusPill
              label={`${Math.round(job.distanceKm)} km`}
              bg="#f3f4f6"
              color="#374151"
              size="sm"
            />
          )}
        </View>

        {/* Route addresses */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotPickup]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Paņemšana</Text>
              <Text style={styles.routeAddress}>
                {job.pickupAddress}, {job.pickupCity}
              </Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDelivery]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Piegāde</Text>
              <Text style={styles.routeAddress}>
                {job.deliveryAddress}, {job.deliveryCity}
              </Text>
            </View>
          </View>
        </View>

        {/* Detail rows */}
        <View style={styles.detailGrid}>
          <DetailRow
            icon={<Calendar size={16} color="#6b7280" />}
            label="Datums"
            value={pickupDate}
          />
          <DetailRow
            icon={<Truck size={16} color="#6b7280" />}
            label="Transportlīdzeklis"
            value={vehicleLabel}
          />
          {job.cargoWeight && (
            <DetailRow
              icon={<Weight size={16} color="#6b7280" />}
              label="Svars"
              value={`${job.cargoWeight} t`}
            />
          )}
          <DetailRow
            icon={<Package size={16} color="#6b7280" />}
            label="Krava"
            value={CARGO_LABEL[job.cargoType] ?? job.cargoType}
          />
        </View>

        {/* Rate */}
        <View style={styles.rateCard}>
          <Text style={styles.rateLabel}>Atlīdzība</Text>
          <Text style={styles.rateValue}>€{job.buyerOfferedRate ?? job.rate}</Text>
          <Text style={styles.rateSub}>bez PVN</Text>
        </View>

        {/* Accept CTA */}
        <Button
          variant="default"
          size="lg"
          className="w-full"
          onPress={handleAccept}
          disabled={accepting}
        >
          {accepting ? 'Apstrādā...' : 'Pieņemt darbu'}
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrapper: {
    height: 200,
    backgroundColor: '#f3f4f6',
  },
  map: { flex: 1 },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  routeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#d1d5db',
    marginLeft: 7,
    marginVertical: 4,
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 2,
  },
  routeDotPickup: { backgroundColor: '#111827' },
  routeDotDelivery: { backgroundColor: '#059669' },
  routeLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  detailGrid: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  detailIcon: { width: 24, alignItems: 'center' },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  rateCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  rateValue: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    lineHeight: 44,
  },
  rateSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    marginTop: 2,
  },
});
