import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Package,
  Ruler,
  Scale,
  TrendingUp,
  Camera,
  CalendarDays,
  Hash,
  Clock,
  Timer,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import { TJB_STATUS } from '@/lib/materials';
import { useFocusEffect } from 'expo-router';

// ── Time helpers ────────────────────────────────────────────
function diffMins(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function fmtMins(mins: number): string {
  if (mins < 0) return `${Math.abs(mins)} min`;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export default function JobStatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [job, setJob] = useState<Awaited<ReturnType<typeof api.transportJobs.getOne>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState<string | null>(null);

  const fetchJob = useCallback(
    async (isRefresh = false) => {
      if (!token || !id) return;
      if (isRefresh) setRefreshing(true);
      try {
        const data = await api.transportJobs.getOne(id, token);
        setJob(data);
      } catch {
        // keep whatever was previously loaded
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useFocusEffect(
    useCallback(() => {
      fetchJob();
    }, [fetchJob]),
  );

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Brauciens" showBack />
        <View className="px-5 pt-4">
          <SkeletonDetail />
        </View>
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Brauciens" showBack />
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '500' }}>
            Brauciens nav atrasts
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const statusMeta = TJB_STATUS[job.status] ?? {
    label: job.status,
    bg: '#f3f4f6',
    color: '#111827',
  };
  const deliveryDate = new Date(job.deliveryDate ?? job.pickupDate);
  const formattedDate = deliveryDate.toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // ── Performance stats ────────────────────────────────────
  const ts =
    job.statusTimestamps && typeof job.statusTimestamps === 'object'
      ? (job.statusTimestamps as Record<string, string>)
      : null;

  const totalMins =
    ts?.EN_ROUTE_PICKUP && ts?.DELIVERED ? diffMins(ts.EN_ROUTE_PICKUP, ts.DELIVERED) : null;
  const loadingWaitMins = ts?.AT_PICKUP && ts?.LOADED ? diffMins(ts.AT_PICKUP, ts.LOADED) : null;
  const pickupDriveMins =
    ts?.EN_ROUTE_PICKUP && ts?.AT_PICKUP ? diffMins(ts.EN_ROUTE_PICKUP, ts.AT_PICKUP) : null;
  const deliveryDriveMins =
    ts?.EN_ROUTE_DELIVERY && ts?.AT_DELIVERY
      ? diffMins(ts.EN_ROUTE_DELIVERY, ts.AT_DELIVERY)
      : null;

  const eurPerKm = job.distanceKm != null && job.distanceKm > 0 ? job.rate / job.distanceKm : null;
  const eurPerHour = totalMins != null && totalMins > 0 ? (job.rate / totalMins) * 60 : null;

  const weightVariancePct =
    job.cargoWeight != null && job.actualWeightKg != null && job.cargoWeight > 0
      ? ((job.actualWeightKg / 1000 - job.cargoWeight) / job.cargoWeight) * 100
      : null;

  const deliveredAt = ts?.DELIVERED ? new Date(ts.DELIVERED) : null;
  const plannedDelivery = job.deliveryDate ? new Date(job.deliveryDate) : null;
  const lateMinutes =
    deliveredAt && plannedDelivery
      ? Math.round((deliveredAt.getTime() - plannedDelivery.getTime()) / 60000)
      : null;

  const hasPerformanceStats =
    totalMins != null ||
    loadingWaitMins != null ||
    pickupDriveMins != null ||
    deliveryDriveMins != null ||
    eurPerKm != null ||
    weightVariancePct != null ||
    lateMinutes != null;

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <ScreenHeader title={`#${job.jobNumber}`} showBack />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchJob(true)}
            tintColor="#111827"
          />
        }
      >
        {/* ── Hero ───────────────────────────────────── */}
        <View style={s.heroBlock}>
          <View style={s.heroRow}>
            <Text style={s.heroAmount}>€{job.rate.toFixed(2)}</Text>
            <StatusPill label={statusMeta.label} bg={statusMeta.bg} color={statusMeta.color} />
          </View>
          <Text style={s.heroRoute}>
            {job.pickupCity} → {job.deliveryCity}
            {job.distanceKm != null ? `  ·  ${Math.round(job.distanceKm)} km` : ''}
          </Text>
        </View>

        {/* ── Details ────────────────────────────────── */}
        <View style={s.card}>
          {/* Job number */}
          <View style={s.row}>
            <Hash size={16} color="#6b7280" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Darba numurs</Text>
              <Text style={s.rowValue}>#{job.jobNumber}</Text>
            </View>
          </View>

          {/* Date */}
          <View style={[s.row, s.rowBorder]}>
            <CalendarDays size={16} color="#6b7280" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Datums</Text>
              <Text style={s.rowValue}>{formattedDate}</Text>
            </View>
          </View>

          {/* Pickup */}
          <View style={[s.row, s.rowBorder]}>
            <MapPin size={16} color="#6b7280" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Iekraušana</Text>
              <Text style={s.rowValue}>
                {job.pickupAddress}, {job.pickupCity}
              </Text>
            </View>
          </View>

          {/* Delivery */}
          <View style={[s.row, s.rowBorder]}>
            <MapPin size={16} color="#111827" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Izkraušana</Text>
              <Text style={s.rowValue}>
                {job.deliveryAddress}, {job.deliveryCity}
              </Text>
            </View>
          </View>

          {/* Distance */}
          <View style={[s.row, s.rowBorder]}>
            <Ruler size={16} color="#6b7280" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Attālums</Text>
              <Text style={s.rowValue}>
                {job.distanceKm != null ? `${Math.round(job.distanceKm)} km` : '–'}
              </Text>
            </View>
          </View>

          {/* Cargo type */}
          <View style={[s.row, s.rowBorder]}>
            <Package size={16} color="#6b7280" />
            <View style={s.rowTexts}>
              <Text style={s.rowLabel}>Krava</Text>
              <Text style={s.rowValue}>{job.cargoType}</Text>
            </View>
          </View>

          {/* Weight */}
          {(job.actualWeightKg != null || job.cargoWeight != null) && (
            <View style={[s.row, s.rowBorder]}>
              <Scale size={16} color="#6b7280" />
              <View style={s.rowTexts}>
                <Text style={s.rowLabel}>
                  {job.actualWeightKg != null ? 'Faktiskais svars (svari)' : 'Plānotais svars'}
                </Text>
                <Text style={s.rowValue}>
                  {job.actualWeightKg != null
                    ? `${(job.actualWeightKg / 1000).toFixed(3)} t`
                    : `${job.cargoWeight} t`}
                </Text>
              </View>
            </View>
          )}

          {/* Price per tonne */}
          {job.pricePerTonne != null && (
            <View style={[s.row, s.rowBorder]}>
              <TrendingUp size={16} color="#6b7280" />
              <View style={s.rowTexts}>
                <Text style={s.rowLabel}>Cena par tonnu</Text>
                <Text style={s.rowValue}>€{job.pricePerTonne.toFixed(2)}/t</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Performance stats ──────────────────────── */}
        {hasPerformanceStats && (
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Veiktspēja</Text>
            </View>

            {/* Total active time */}
            {totalMins != null && (
              <View style={[s.row, s.rowBorder]}>
                <Clock size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Kopējais laiks</Text>
                  <Text style={s.rowValue}>{fmtMins(totalMins)}</Text>
                </View>
              </View>
            )}

            {/* Drive to pickup */}
            {pickupDriveMins != null && (
              <View style={[s.row, s.rowBorder]}>
                <Timer size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Braukšana uz iekraušanu</Text>
                  <Text style={s.rowValue}>{fmtMins(pickupDriveMins)}</Text>
                </View>
              </View>
            )}

            {/* Loading wait */}
            {loadingWaitMins != null && (
              <View style={[s.row, s.rowBorder]}>
                <Timer size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Gaidīšana iekraušanā</Text>
                  <Text style={s.rowValue}>{fmtMins(loadingWaitMins)}</Text>
                </View>
              </View>
            )}

            {/* Drive to delivery */}
            {deliveryDriveMins != null && (
              <View style={[s.row, s.rowBorder]}>
                <Timer size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Braukšana uz piegādi</Text>
                  <Text style={s.rowValue}>{fmtMins(deliveryDriveMins)}</Text>
                </View>
              </View>
            )}

            {/* Efficiency: €/km and €/h */}
            {eurPerKm != null && (
              <View style={[s.row, s.rowBorder]}>
                <Zap size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Efektivitāte</Text>
                  <Text style={s.rowValue}>
                    €{eurPerKm.toFixed(2)}/km
                    {eurPerHour != null ? `  ·  €${eurPerHour.toFixed(2)}/h` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Weight variance */}
            {weightVariancePct != null && (
              <View style={[s.row, s.rowBorder]}>
                <Scale size={16} color="#6b7280" />
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Svara novirze</Text>
                  <Text
                    style={[
                      s.rowValue,
                      {
                        color: Math.abs(weightVariancePct) > 10 ? '#ef4444' : colors.textPrimary,
                      },
                    ]}
                  >
                    {weightVariancePct >= 0 ? '+' : ''}
                    {weightVariancePct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Punctuality */}
            {lateMinutes != null && (
              <View style={[s.row, s.rowBorder]}>
                {lateMinutes <= 0 ? (
                  <CheckCircle2 size={16} color="#22c55e" />
                ) : (
                  <AlertCircle size={16} color="#f59e0b" />
                )}
                <View style={s.rowTexts}>
                  <Text style={s.rowLabel}>Piegāde</Text>
                  <Text style={[s.rowValue, { color: lateMinutes <= 0 ? '#22c55e' : '#f59e0b' }]}>
                    {lateMinutes <= 0
                      ? `Laicīgi${lateMinutes < 0 ? ` (${Math.abs(lateMinutes)} min agrāk)` : ''}`
                      : `${fmtMins(lateMinutes)} kavēšanās`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Weighing slip photo ─────────────────────── */}
        {job.pickupPhotoUrl && (
          <View style={s.photoSection}>
            <View style={s.photoLabelRow}>
              <Camera size={14} color="#6b7280" />
              <Text style={s.photoLabel}>Svaru kvīts foto</Text>
            </View>
            <TouchableOpacity
              onPress={() => setPhotoFullscreen(job.pickupPhotoUrl)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: job.pickupPhotoUrl }} style={s.photo} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Fullscreen photo ────────────────────────── */}
      <Modal
        visible={photoFullscreen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoFullscreen(null)}
      >
        <Pressable style={s.fsBackdrop} onPress={() => setPhotoFullscreen(null)}>
          {photoFullscreen && (
            <Image source={{ uri: photoFullscreen }} style={s.fsPhoto} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1.5,
  },
  heroRoute: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: -0.2,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.textDisabled,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  photoSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
  },
  sectionHeader: {
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fsBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fsPhoto: {
    width: '100%',
    height: '100%',
  },
});
