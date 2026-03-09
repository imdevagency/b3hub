/**
 * tour-planner.tsx — Multi-stop route optimizer for drivers
 *
 * Receives selected jobs as JSON via router params (from jobs.tsx tour mode).
 * Calls the Google Route Optimization API to find the best visit order,
 * then shows the reordered stops on a map.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Route, MapPin, Truck, Calendar, Ruler, ChevronRight, Zap } from 'lucide-react-native';
import { t } from '@/lib/translations';
import { optimizeRoute, type Stop } from '@/lib/maps';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import type { ExtraPin } from '@/components/ui/JobRouteMap';

// ── Types (mirrors jobs.tsx TransportJob) ──────────────────────────────────────
interface TourJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  payload: string;
  weightTonnes: number;
  fromCity: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toCity: string;
  toAddress: string;
  toLat: number;
  toLng: number;
  distanceKm: number;
  date: string;
  time: string;
  priceTotal: number;
  currency: string;
}

// ── Stop number badge ──────────────────────────────────────────────────────────
function StopBadge({ n, color = '#7c3aed' }: { n: number; color?: string }) {
  return (
    <View style={[badge.wrap, { backgroundColor: color }]}>
      <Text style={badge.text}>{n}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

// ── Job stop card ──────────────────────────────────────────────────────────────
function StopCard({ job, index }: { job: TourJob; index: number }) {
  return (
    <View style={s.stopCard}>
      <View style={s.stopLeft}>
        <StopBadge n={index + 1} />
        <View style={s.stopConnector} />
      </View>
      <View style={s.stopBody}>
        <Text style={s.stopJobNum}>{job.jobNumber}</Text>
        <View style={s.stopRoute}>
          <View style={[s.routeDot, { backgroundColor: '#16a34a' }]} />
          <Text style={s.stopCity}>{job.fromCity}</Text>
          <ChevronRight size={12} color="#9ca3af" />
          <View style={[s.routeDot, { backgroundColor: '#dc2626' }]} />
          <Text style={s.stopCity}>{job.toCity}</Text>
        </View>
        <View style={s.stopMeta}>
          <View style={s.metaChip}>
            <Truck size={11} color="#6b7280" />
            <Text style={s.metaChipText}>{job.vehicleType}</Text>
          </View>
          <View style={s.metaChip}>
            <Ruler size={11} color="#6b7280" />
            <Text style={s.metaChipText}>{job.distanceKm} km</Text>
          </View>
          <View style={s.metaChip}>
            <Calendar size={11} color="#6b7280" />
            <Text style={s.metaChipText}>{job.date}</Text>
          </View>
          <Text style={s.stopPrice}>
            {job.priceTotal.toFixed(2)} {job.currency}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TourPlannerScreen() {
  const router = useRouter();
  const { jobsJson } = useLocalSearchParams<{ jobsJson: string }>();

  const [jobs] = useState<TourJob[]>(() => {
    try {
      return JSON.parse(jobsJson ?? '[]') as TourJob[];
    } catch {
      return [];
    }
  });

  const [orderedJobs, setOrderedJobs] = useState<TourJob[]>(jobs);
  const [optimizing, setOptimizing] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);

  const handleOptimize = async () => {
    if (orderedJobs.length < 2) return;
    setOptimizing(true);
    try {
      const stops: Stop[] = orderedJobs.map((j) => ({
        lat: j.fromLat,
        lng: j.fromLng,
        label: j.jobNumber,
      }));

      const result = await optimizeRoute(stops);
      const reordered = result.visitOrder.map((i) => orderedJobs[i]);
      setOrderedJobs(reordered);
      setTotalDistanceKm(result.totalDistanceKm > 0 ? result.totalDistanceKm : null);
      setOptimized(true);
    } catch (err) {
      Alert.alert(t.tourPlanner.title, String(err));
    } finally {
      setOptimizing(false);
    }
  };

  if (jobs.length === 0) {
    return (
      <ScreenContainer standalone bg="#f3f4f6">
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <X size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t.tourPlanner.title}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.empty}>
          <Route size={48} color="#d1d5db" />
          <Text style={s.emptyText}>{t.tourPlanner.noJobs}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Build map pins from ordered jobs (pickup → delivery of the tour)
  const mapPickup = {
    lat: orderedJobs[0].fromLat,
    lng: orderedJobs[0].fromLng,
    label: orderedJobs[0].fromCity,
  };
  const mapDelivery = {
    lat: orderedJobs[orderedJobs.length - 1].toLat,
    lng: orderedJobs[orderedJobs.length - 1].toLng,
    label: orderedJobs[orderedJobs.length - 1].toCity,
  };
  const mapExtras: ExtraPin[] = orderedJobs.slice(1).map((j) => ({
    lat: j.fromLat,
    lng: j.fromLng,
    label: j.fromCity,
    type: 'waypoint' as const,
  }));

  const totalJobKm = orderedJobs.reduce((sum, j) => sum + j.distanceKm, 0);
  const totalEur = orderedJobs.reduce((sum, j) => sum + j.priceTotal, 0);

  return (
    <ScreenContainer standalone bg="#f3f4f6">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <X size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.tourPlanner.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Summary bar */}
        <View style={s.summaryBar}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{orderedJobs.length}</Text>
            <Text style={s.summaryLabel}>darbi</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{totalJobKm.toFixed(0)} km</Text>
            <Text style={s.summaryLabel}>kopā km</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryValue, { color: '#16a34a' }]}>{totalEur.toFixed(2)} €</Text>
            <Text style={s.summaryLabel}>ienākumi</Text>
          </View>
        </View>

        {/* Route map */}
        <View style={s.mapWrap}>
          <JobRouteMap
            pickup={mapPickup}
            delivery={mapDelivery}
            extras={mapExtras}
            height={240}
            borderRadius={16}
            showToPickupLeg={false}
          />
          {optimized && totalDistanceKm && totalDistanceKm > 0 && (
            <View style={s.mapBadge}>
              <Zap size={13} color="#7c3aed" />
              <Text style={s.mapBadgeText}>{t.tourPlanner.totalDistance(totalDistanceKm)}</Text>
            </View>
          )}
        </View>

        {/* Optimize button */}
        {!optimized && (
          <TouchableOpacity
            style={[s.optimizeBtn, optimizing && s.optimizeBtnLoading]}
            onPress={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.optimizeBtnText}>{t.tourPlanner.optimizing}</Text>
              </>
            ) : (
              <>
                <Zap size={18} color="#fff" />
                <Text style={s.optimizeBtnText}>{t.tourPlanner.optimizeBtn}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {optimized && (
          <View style={s.optimizedBanner}>
            <Zap size={15} color="#7c3aed" />
            <Text style={s.optimizedBannerText}>{t.tourPlanner.optimizedTitle}</Text>
          </View>
        )}

        {/* Ordered stop list */}
        <Text style={s.sectionLabel}>
          {optimized ? t.tourPlanner.optimizedTitle : t.tourPlanner.originalOrder}
        </Text>
        {orderedJobs.map((job, i) => (
          <StopCard key={job.id} job={job} index={i} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af' },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#f3f4f6' },

  mapWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    position: 'relative',
  },
  mapBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapBadgeText: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },

  optimizeBtn: {
    backgroundColor: '#7c3aed',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  optimizeBtnLoading: { opacity: 0.7 },
  optimizeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  optimizedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  optimizedBannerText: { fontSize: 14, fontWeight: '600', color: '#7c3aed' },

  sectionLabel: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  stopCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  stopLeft: {
    width: 36,
    alignItems: 'center',
    paddingTop: 12,
  },
  stopConnector: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  stopBody: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginLeft: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stopJobNum: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginBottom: 6 },
  stopRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stopCity: { fontSize: 14, fontWeight: '600', color: '#111827' },
  stopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  metaChipText: { fontSize: 11, color: '#6b7280' },
  stopPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
    marginLeft: 'auto',
  },
});
