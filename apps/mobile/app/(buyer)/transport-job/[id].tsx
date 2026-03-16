import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Truck,
  Recycle,
  Phone,
  User,
  Package,
  Navigation,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import type { ApiTransportJob } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Constants ──────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'AVAILABLE', label: 'Iesniegts', hint: 'Meklē pārvadātāju' },
  { key: 'ASSIGNED', label: 'Piešķirts', hint: 'Pārvadātājs atrasts' },
  { key: 'ACCEPTED', label: 'Apstiprināts', hint: 'Pasūtījums apstiprināts' },
  { key: 'EN_ROUTE_PICKUP', label: 'Brauc', hint: 'Brauc uz iekraušanu' },
  { key: 'LOADED', label: 'Iekrauts', hint: 'Krava iekrauta' },
  { key: 'EN_ROUTE_DELIVERY', label: 'Ceļā', hint: 'Ceļā uz galamērķi' },
  { key: 'DELIVERED', label: 'Piegādāts', hint: 'Piegāde pabeigta' },
];

const STATUS_ORDER = [
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
];

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  AVAILABLE: { label: 'Gaida pārvadātāju', bg: '#f3f4f6', color: '#6b7280' },
  ASSIGNED: { label: 'Pārvadātājs atrasts', bg: '#f3f4f6', color: '#374151' },
  ACCEPTED: { label: 'Apstiprināts', bg: '#dbeafe', color: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz iekraušanu', bg: '#fef3c7', color: '#92400e' },
  AT_PICKUP: { label: 'Iekraujas', bg: '#fef3c7', color: '#92400e' },
  LOADED: { label: 'Iekrauts', bg: '#fef3c7', color: '#92400e' },
  EN_ROUTE_DELIVERY: { label: 'Ceļā', bg: '#dcfce7', color: '#15803d' },
  AT_DELIVERY: { label: 'Piegādā', bg: '#dcfce7', color: '#15803d' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', color: '#15803d' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', color: '#b91c1c' },
};

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Stepper ────────────────────────────────────────────────────

function StatusStepper({ status }: { status: string }) {
  const activeIdx = STATUS_ORDER.indexOf(status);
  const visibleSteps = STATUS_STEPS;

  return (
    <View style={s.stepper}>
      {visibleSteps.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const done = stepIdx < activeIdx;
        const active = stepIdx <= activeIdx;
        return (
          <View key={step.key} style={s.stepRow}>
            <View style={s.stepLeft}>
              <View style={[s.stepDot, active ? s.stepDotActive : s.stepDotInactive]}>
                {done ? (
                  <Text style={s.stepCheck}>✓</Text>
                ) : (
                  <Text
                    style={[s.stepNum, active ? s.stepNumActive : s.stepNumInactive]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < visibleSteps.length - 1 && (
                <View style={[s.stepLine, done ? s.stepLineActive : s.stepLineInactive]} />
              )}
            </View>
            <View style={s.stepContent}>
              <Text style={[s.stepLabel, active ? s.stepLabelActive : s.stepLabelInactive]}>
                {step.label}
              </Text>
              {active && (
                <Text style={s.stepHint}>{step.hint}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Info Row ───────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <Icon size={14} color="#6b7280" strokeWidth={2} />
      </View>
      <View style={s.infoText}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function TransportJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    // Fetch buyer's jobs and find the matching one
    api.transportJobs
      .myRequests(token)
      .then((jobs) => {
        const found = jobs.find((j) => j.id === id) ?? null;
        setJob(found);
      })
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
  }, [id, token]);

  const isDisposal = job?.jobType === 'WASTE_COLLECTION';
  const Icon = isDisposal ? Recycle : Truck;
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';
  const st = job ? (STATUS_LABEL[job.status] ?? STATUS_LABEL.AVAILABLE) : null;

  return (
    <ScreenContainer bg="#f2f2f7">
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            haptics.light();
            router.back();
          }}
          activeOpacity={0.8}
          hitSlop={12}
        >
          <ArrowLeft size={20} color="#111827" strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {loading ? 'Ielādē...' : (job?.jobNumber ?? 'Pasūtījums')}
          </Text>
          {st && (
            <Text style={[s.headerStatus, { color: st.color }]}>{st.label}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#111827" size="large" />
        </View>
      ) : !job ? (
        <View style={s.center}>
          <Package size={48} color="#d1d5db" />
          <Text style={s.emptyTitle}>Pasūtījums nav atrasts</Text>
          <TouchableOpacity style={s.backLink} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.backLinkText}>Atpakaļ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {/* Type + Status pill */}
          <View style={s.typePill}>
            <Icon size={14} color="#6b7280" strokeWidth={2} />
            <Text style={s.typePillText}>{typeLabel}</Text>
            <View style={[s.statusBadge, { backgroundColor: st!.bg }]}>
              <Text style={[s.statusBadgeText, { color: st!.color }]}>{st!.label}</Text>
            </View>
          </View>

          {/* Progress stepper */}
          {job.status !== 'CANCELLED' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pasūtījuma statuss</Text>
              <StatusStepper status={job.status} />
            </View>
          )}

          {/* Route card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Maršruts</Text>
            <View style={s.routeRow}>
              <View style={s.routeDot} />
              <View style={s.routeInfo}>
                <Text style={s.routePlace}>{job.pickupCity}</Text>
                <Text style={s.routeAddr} numberOfLines={2}>{job.pickupAddress}</Text>
              </View>
            </View>
            {job.distanceKm != null && (
              <View style={s.routeDistRow}>
                <View style={s.routeLine} />
                <Text style={s.routeDist}>{job.distanceKm.toFixed(0)} km</Text>
              </View>
            )}
            <View style={s.routeRow}>
              <View style={[s.routeDot, s.routeDotDest]} />
              <View style={s.routeInfo}>
                <Text style={s.routePlace}>{job.deliveryCity}</Text>
                <Text style={s.routeAddr} numberOfLines={2}>{job.deliveryAddress}</Text>
              </View>
            </View>
          </View>

          {/* Details card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Detaļas</Text>
            <InfoRow icon={Package} label="Krava" value={job.cargoType} />
            {job.cargoWeight != null && (
              <InfoRow
                icon={Package}
                label="Svars"
                value={`${(job.cargoWeight / 1000).toFixed(1)} t`}
              />
            )}
            <InfoRow icon={Truck} label="Transportlīdzeklis" value={job.requiredVehicleType} />
            <InfoRow icon={CalendarDays} label="Izbraukšanas datums" value={formatDate(job.pickupDate)} />
            <InfoRow icon={Clock} label="Piegādes datums" value={formatDate(job.deliveryDate)} />
            {job.pickupWindow && (
              <InfoRow icon={Clock} label="Iekraušanas laiks" value={job.pickupWindow} />
            )}
          </View>

          {/* Driver card */}
          {job.driver && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pārvadātājs</Text>
              <View style={s.driverRow}>
                <View style={s.driverAvatar}>
                  <User size={20} color="#374151" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>
                    {job.driver.firstName} {job.driver.lastName}
                  </Text>
                  {job.vehicle && (
                    <Text style={s.driverSub}>
                      {job.vehicle.vehicleType} · {job.vehicle.licensePlate}
                    </Text>
                  )}
                </View>
                {job.driver.phone && (
                  <TouchableOpacity
                    style={s.callBtn}
                    onPress={() => {
                      haptics.light();
                      Linking.openURL(`tel:${job.driver!.phone}`);
                    }}
                    activeOpacity={0.8}
                  >
                    <Phone size={14} color="#fff" strokeWidth={2} />
                    <Text style={s.callBtnText}>Zvanīt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Pricing card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Cena</Text>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Tarifs</Text>
              <Text style={s.priceValue}>
                €{job.rate.toFixed(2)}
                {job.pricePerTonne != null ? ` (€${job.pricePerTonne.toFixed(2)}/t)` : ''}
              </Text>
            </View>
            {job.actualWeightKg != null && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Faktiskais svars</Text>
                <Text style={s.priceValue}>{(job.actualWeightKg / 1000).toFixed(2)} t</Text>
              </View>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f2f2f7',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerStatus: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  backLink: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  typePillText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Stepper
  stepper: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepLeft: { alignItems: 'center', width: 28 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#111827' },
  stepDotInactive: { backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb' },
  stepLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  stepLineActive: { backgroundColor: '#111827' },
  stepLineInactive: { backgroundColor: '#e5e7eb' },
  stepContent: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 14, fontWeight: '600' },
  stepLabelActive: { color: '#111827' },
  stepLabelInactive: { color: '#9ca3af' },
  stepHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stepCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepNumActive: { color: '#fff' },
  stepNumInactive: { color: '#9ca3af' },

  // ── Route
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    marginTop: 4,
  },
  routeDotDest: { backgroundColor: '#6b7280' },
  routeInfo: { flex: 1 },
  routePlace: { fontSize: 15, fontWeight: '700', color: '#111827' },
  routeAddr: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  routeDistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  routeLine: { width: 2, height: 20, backgroundColor: '#e5e7eb' },
  routeDist: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  // ── Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 1 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

  // ── Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  driverSub: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ── Pricing
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
});
