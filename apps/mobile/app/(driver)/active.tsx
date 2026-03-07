import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob, ApiReturnTripJob } from '@/lib/api';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { Map, Phone, CheckCircle2, Navigation2, Route, Truck } from 'lucide-react-native';

// ── Status progression ────────────────────────────────────────────────────────
const STATUS_STEPS = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
] as const;

type JobStatus = (typeof STATUS_STEPS)[number];

const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  ACCEPTED: 'EN_ROUTE_PICKUP',
  EN_ROUTE_PICKUP: 'AT_PICKUP',
  AT_PICKUP: 'LOADED',
  LOADED: 'EN_ROUTE_DELIVERY',
  EN_ROUTE_DELIVERY: 'AT_DELIVERY',
  AT_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

// Statuses in which return trip suggestions are contextually relevant
const RETURN_TRIP_STATUSES: JobStatus[] = ['EN_ROUTE_DELIVERY', 'AT_DELIVERY'];

export default function ActiveJobScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [job, setJob] = React.useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [currentLat, setCurrentLat] = React.useState<number | null>(null);
  const [currentLng, setCurrentLng] = React.useState<number | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  // Return trips — fetched automatically when nearing delivery
  const [returnTrips, setReturnTrips] = React.useState<ApiReturnTripJob[]>([]);
  const [returnTripsLoading, setReturnTripsLoading] = React.useState(false);
  const [returnDismissed, setReturnDismissed] = React.useState(false);
  const [acceptingReturnId, setAcceptingReturnId] = React.useState<string | null>(null);

  // ── Fetch return trips when status enters EN_ROUTE_DELIVERY / AT_DELIVERY ──
  useEffect(() => {
    if (!token || !job) return;
    const status = job.status as JobStatus;
    if (!RETURN_TRIP_STATUSES.includes(status)) return;
    if (job.deliveryLat == null || job.deliveryLng == null) return;
    setReturnTripsLoading(true);
    api.transportJobs
      .returnTrips(job.deliveryLat, job.deliveryLng, 75, token)
      .then((trips) => setReturnTrips(trips))
      .catch(() => setReturnTrips([]))
      .finally(() => setReturnTripsLoading(false));
  }, [token, job?.status, job?.deliveryLat, job?.deliveryLng]);

  const handleAcceptReturnTrip = (tripId: string, fromCity: string, toCity: string) => {
    if (!token) return;
    Alert.alert('Pieņemt atpakaļceļa darbu?', `${fromCity} → ${toCity}`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Pieņemt',
        onPress: async () => {
          setAcceptingReturnId(tripId);
          try {
            await api.transportJobs.accept(tripId, token);
            setReturnTrips((prev) => prev.filter((t) => t.id !== tripId));
            Alert.alert('✓ Darbs pieņemts', 'Atpakaļceļa darbs pievienots jūsu darbu sarakstam.');
          } catch (err: any) {
            Alert.alert('Kļūda', err.message ?? 'Neizdevās pieņemt darbu');
          } finally {
            setAcceptingReturnId(null);
          }
        },
      },
    ]);
  };

  const fetchActiveJob = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.transportJobs.myActive(token);
      setJob(data);
    } catch (e) {
      console.error('Failed to fetch active job', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchActiveJob();
  }, [fetchActiveJob]);

  // ── Live GPS tracking ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30, // update every 30 m
          timeInterval: 10_000, // or every 10 s
        },
        (loc) => {
          setCurrentLat(loc.coords.latitude);
          setCurrentLng(loc.coords.longitude);
        },
      );
    })();

    return () => {
      active = false;
      locationSub.current?.remove();
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.empty}>
          <Map size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t.activeJob.noJob}</Text>
          <Text style={styles.emptyDesc}>{t.activeJob.noJobDesc}</Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(driver)/jobs')}>
            <Text style={styles.goBtnText}>{t.activeJob.goToJobs}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = job.status as JobStatus;
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  const nextStatus = NEXT_STATUS[currentStatus];

  // ── Navigate — in-app Navigation SDK (requires dev build)
  //   Falls back to deep-link for Expo Go / environments where the native
  //   Navigation SDK module is unavailable.
  const handleNavigate = () => {
    const isHeadingToPickup = currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';

    // If we have coords, launch the in-app navigation screen
    if (job.deliveryLat != null && job.deliveryLng != null) {
      const params: Record<string, string> = {
        deliveryLat: String(job.deliveryLat),
        deliveryLng: String(job.deliveryLng),
        label: `${job.deliveryAddress}, ${job.deliveryCity}`,
      };
      if (isHeadingToPickup && job.pickupLat != null && job.pickupLng != null) {
        params.pickupLat = String(job.pickupLat);
        params.pickupLng = String(job.pickupLng);
      }
      router.push({ pathname: '/navigation', params });
      return;
    }

    // Fallback: deep-link to external maps app
    const address = isHeadingToPickup
      ? `${job.pickupAddress}, ${job.pickupCity}`
      : `${job.deliveryAddress}, ${job.deliveryCity}`;
    const encoded = encodeURIComponent(address);
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${encoded}&dirflg=d`
        : `google.navigation:q=${encoded}&mode=d`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        return Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
        );
      })
      .catch(() => Alert.alert('Kļūda', 'Neizdevās atvērt navigāciju'));
  };

  const handleCall = (phone: string | null | undefined, name?: string | null) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'));
    } else {
      Alert.alert(
        t.activeJob.noContact,
        name ? `${name}: ${t.activeJob.noContactDesc}` : t.activeJob.noContactDesc,
      );
    }
  };

  const handleUpdateStatus = () => {
    if (!nextStatus || !token) return;

    // AT_DELIVERY → DELIVERED requires delivery proof (photo + signature)
    if (currentStatus === 'AT_DELIVERY') {
      router.push({ pathname: '/delivery-proof', params: { jobId: job.id } });
      return;
    }

    Alert.alert(t.activeJob.updateStatus, `→ ${t.activeJob.status[nextStatus]}`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Apstiprināt',
        onPress: async () => {
          try {
            const updated = await api.transportJobs.updateStatus(job.id, nextStatus, token);
            setJob(updated);
          } catch (err: any) {
            Alert.alert('Kļūda', err.message ?? 'Neizdevās atjaunināt statusu');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.activeJob.title}</Text>
          <View style={styles.priceTag}>
            <Text style={styles.price}>€{job.rate.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── Interactive map ── */}
        {job.pickupLat != null &&
          job.pickupLng != null &&
          job.deliveryLat != null &&
          job.deliveryLng != null && (
            <JobRouteMap
              pickup={{
                lat: job.pickupLat,
                lng: job.pickupLng,
                label: job.pickupCity,
              }}
              delivery={{
                lat: job.deliveryLat,
                lng: job.deliveryLng,
                label: job.deliveryCity,
              }}
              current={
                currentLat != null && currentLng != null
                  ? { lat: currentLat, lng: currentLng }
                  : null
              }
              // Show dashed leg only when heading to pickup
              showToPickupLeg={currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'}
              height={240}
              borderRadius={16}
              style={styles.mapCard}
            />
          )}

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {t.activeJob.status[currentStatus] ?? currentStatus}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            {STATUS_STEPS.map((step, i) => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  i <= currentIndex && styles.progressDotActive,
                  i < currentIndex && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Job details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            #{job.jobNumber} · {job.cargoType} {job.cargoWeight ?? 0}t
          </Text>

          <View style={styles.routeSection}>
            {/* From */}
            <View style={styles.routeRow}>
              <View style={styles.routeDot} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>{t.jobs.from}</Text>
                <Text style={styles.routeValue}>
                  {job.pickupAddress}, {job.pickupCity}
                </Text>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(null)}>
                <Phone size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.routeLine} />

            {/* To */}
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>{t.jobs.to}</Text>
                <Text style={styles.routeValue}>
                  {job.deliveryAddress}, {job.deliveryCity}
                </Text>
                {job.order?.siteContactName ? (
                  <Text style={styles.siteContactName}>
                    {t.activeJob.siteForeman}: {job.order.siteContactName}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.callBtn,
                  job.order?.siteContactPhone ? styles.callBtnActive : undefined,
                ]}
                onPress={() => handleCall(job.order?.siteContactPhone, job.order?.siteContactName)}
              >
                <Phone size={18} color={job.order?.siteContactPhone ? '#ffffff' : '#374151'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Auto Return Trips strip ── */}
        {!returnDismissed &&
          RETURN_TRIP_STATUSES.includes(currentStatus) &&
          (returnTripsLoading || returnTrips.length > 0) && (
            <View style={styles.returnStrip}>
              <View style={styles.returnStripHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Route size={16} color="#059669" />
                  <Text style={styles.returnStripTitle}>{t.avoidEmptyRuns.bannerTitle}</Text>
                  {returnTrips.length > 0 && (
                    <View style={styles.returnCountPill}>
                      <Text style={styles.returnCountPillText}>{returnTrips.length}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setReturnDismissed(true)}>
                  <Text style={styles.returnStripDismiss}>✕</Text>
                </TouchableOpacity>
              </View>

              {returnTripsLoading ? (
                <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <Text style={styles.returnStripDesc}>
                    {t.avoidEmptyRuns.bannerDesc(job!.deliveryCity)}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 10 }}
                    contentContainerStyle={{ gap: 10, paddingRight: 4 }}
                  >
                    {returnTrips.slice(0, 5).map((rt) => (
                      <View key={rt.id} style={styles.returnMiniCard}>
                        <View style={styles.returnMiniKmBadge}>
                          <Route size={10} color="#059669" />
                          <Text style={styles.returnMiniKmText}>{rt.returnDistanceKm} km</Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 6,
                          }}
                        >
                          <Truck size={12} color="#6b7280" />
                          <Text style={styles.returnMiniRoute}>
                            {rt.pickupCity} → {rt.deliveryCity}
                          </Text>
                        </View>
                        <Text style={styles.returnMiniWeight}>
                          {rt.cargoWeight ?? 0} t · {rt.cargoType}
                        </Text>
                        <Text style={styles.returnMiniPrice}>€{rt.rate.toFixed(0)}</Text>
                        <TouchableOpacity
                          style={[
                            styles.returnMiniAcceptBtn,
                            acceptingReturnId === rt.id && { opacity: 0.6 },
                          ]}
                          onPress={() =>
                            handleAcceptReturnTrip(rt.id, rt.pickupCity, rt.deliveryCity)
                          }
                          disabled={acceptingReturnId !== null}
                        >
                          {acceptingReturnId === rt.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.returnMiniAcceptText}>Pieņemt →</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.returnStripCta}
                    onPress={() => router.push('/(driver)/jobs')}
                  >
                    <Text style={styles.returnStripCtaText}>{t.avoidEmptyRuns.seeAllJobs}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Navigation2 size={18} color="#ffffff" />
              <Text style={styles.navigateBtnText}>{t.activeJob.navigate}</Text>
            </View>
          </TouchableOpacity>

          {nextStatus && (
            <TouchableOpacity
              style={[styles.nextBtn, currentStatus === 'AT_DELIVERY' && styles.nextBtnProof]}
              onPress={handleUpdateStatus}
            >
              {currentStatus === 'AT_DELIVERY' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color="#fff" />
                  <Text style={styles.nextBtnText}>{t.deliveryProof.title}</Text>
                </View>
              ) : (
                <Text style={styles.nextBtnText}>{t.activeJob.nextStep} →</Text>
              )}
            </TouchableOpacity>
          )}

          {!nextStatus && (
            <View style={styles.completedBanner}>
              <CheckCircle2 size={20} color="#16a34a" />
              <Text style={styles.completedText}>Piegādāts!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },
  mapCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  priceTag: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  price: { color: '#fff', fontWeight: '800', fontSize: 18 },

  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    flex: 1,
  },
  progressDotActive: { backgroundColor: '#fca5a5' },
  progressDotDone: { backgroundColor: '#dc2626' },

  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailsTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },

  routeSection: { gap: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#dc2626',
    borderWidth: 3,
    borderColor: '#fecaca',
  },
  routeDotEnd: { backgroundColor: '#16a34a', borderColor: '#bbf7d0' },
  routeLine: { width: 2, height: 20, backgroundColor: '#e5e7eb', marginLeft: 6 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  siteContactName: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnActive: { backgroundColor: '#16a34a' },
  callBtnText: { fontSize: 18 },

  actionsRow: { gap: 10 },
  navigateBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navigateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnProof: {
    backgroundColor: '#16a34a',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  completedBanner: {
    backgroundColor: '#dcfce7',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  completedText: { color: '#16a34a', fontWeight: '700', fontSize: 16 },

  // Return trips strip
  returnStrip: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 2,
  },
  returnStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  returnStripTitle: { fontSize: 14, fontWeight: '700', color: '#065f46' },
  returnCountPill: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  returnCountPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  returnStripDismiss: { fontSize: 16, color: '#9ca3af', paddingLeft: 8 },
  returnStripDesc: { fontSize: 12, color: '#047857', marginTop: 4 },
  returnMiniCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    width: 170,
  },
  returnMiniKmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  returnMiniKmText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  returnMiniRoute: { fontSize: 13, fontWeight: '600', color: '#111827' },
  returnMiniWeight: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  returnMiniPrice: { fontSize: 15, fontWeight: '800', color: '#059669', marginTop: 6 },
  returnMiniAcceptBtn: {
    marginTop: 8,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  returnMiniAcceptText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  returnStripCta: { marginTop: 10 },
  returnStripCtaText: { fontSize: 13, color: '#059669', fontWeight: '600' },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  goBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
