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
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob, ApiReturnTripJob } from '@/lib/api';
import { startLocationTracking, stopLocationTracking } from '@/lib/location-task';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Map,
  Phone,
  CheckCircle2,
  Navigation2,
  Route,
  Truck,
  Camera,
  CheckCircle,
  MessageCircle,
} from 'lucide-react-native';

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
  // Keep a stable ref to the current job so the GPS callback can access its id
  const jobRef = useRef<ApiTransportJob | null>(null);
  // Return trips — fetched automatically when nearing delivery
  const [returnTrips, setReturnTrips] = React.useState<ApiReturnTripJob[]>([]);
  const [returnTripsLoading, setReturnTripsLoading] = React.useState(false);
  const [returnDismissed, setReturnDismissed] = React.useState(false);
  const [acceptingReturnId, setAcceptingReturnId] = React.useState<string | null>(null);

  // ── Weight ticket modal ──────────────────────────────────────
  const [weightModalVisible, setWeightModalVisible] = React.useState(false);
  const [weightInput, setWeightInput] = React.useState('');
  const [weightSubmitting, setWeightSubmitting] = React.useState(false);
  const [pickupPhotoUri, setPickupPhotoUri] = React.useState<string | null>(null);

  const handleTakePickupPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Kamera nav atļauta', 'Liešojiet kameras atļauju lietotnēs iestatījumos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPickupPhotoUri(result.assets[0].uri);
    }
  };

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
      jobRef.current = data;
    } catch (e) {
      console.error('Failed to fetch active job', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchActiveJob();
  }, [fetchActiveJob]);

  // ── Background + foreground GPS tracking ──────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      // Start background task (handles backend updates in both foreground + background)
      if (jobRef.current?.id) {
        startLocationTracking(jobRef.current.id).catch(() => {});
      }

      // Also watch position for live map dot updates in the UI only
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 10_000,
        },
        (loc) => {
          if (!active) return;
          setCurrentLat(loc.coords.latitude);
          setCurrentLng(loc.coords.longitude);
        },
      );
    })();

    return () => {
      active = false;
      locationSub.current?.remove();
      stopLocationTracking().catch(() => {});
    };
  }, []);

  // ── Active-dot pulse animation ─────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.45, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#f9fafb">
        <EmptyState
          icon={<Map size={32} color="#9ca3af" />}
          title={t.activeJob.noJob}
          subtitle={t.activeJob.noJobDesc}
          action={
            <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(driver)/jobs')}>
              <Text style={styles.goBtnText}>{t.activeJob.goToJobs}</Text>
            </TouchableOpacity>
          }
        />
      </ScreenContainer>
    );
  }

  const currentStatus = job.status as JobStatus;
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  const nextStatus = NEXT_STATUS[currentStatus];

  const phaseColor =
    currentStatus === 'DELIVERED'
      ? { bg: '#dcfce7', border: '#86efac', text: '#15803d', phase: 'Piegādāts ✓' }
      : currentIndex >= 4
        ? { bg: '#d1fae5', border: '#6ee7b7', text: '#059669', phase: 'Piegādes fāze' }
        : { bg: '#fef3c7', border: '#fde68a', text: '#d97706', phase: 'Iekraušanas fāze' };

  // ── Navigate — Schüttflix-style app picker ────────────────────────────────
  //   Shows Waze / Google Maps / Apple Maps action sheet.
  //   Always uses coordinates (not address text) for precision.
  const handleNavigate = () => {
    const isHeadingToPickup = currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';

    const lat = isHeadingToPickup ? (job.pickupLat ?? job.deliveryLat) : job.deliveryLat;
    const lng = isHeadingToPickup ? (job.pickupLng ?? job.deliveryLng) : job.deliveryLng;
    const label = isHeadingToPickup
      ? `${job.pickupAddress}, ${job.pickupCity}`
      : `${job.deliveryAddress}, ${job.deliveryCity}`;

    if (lat == null || lng == null) {
      // Coords missing — fall back to address search in Google Maps web
      const encoded = encodeURIComponent(label);
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
      ).catch(() => Alert.alert('Kļūda', 'Neizdevās atvērt navigāciju'));
      return;
    }

    const openUrl = (url: string, fallback: string) =>
      Linking.canOpenURL(url)
        .then((ok) => Linking.openURL(ok ? url : fallback))
        .catch(() => Alert.alert('Kļūda', 'Neizdevās atvērt navigāciju'));

    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const googleUrlNative =
      Platform.OS === 'ios'
        ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
        : `google.navigation:q=${lat},${lng}&mode=d`;
    const googleFallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const appleUrl = `maps://?daddr=${lat},${lng}&dirflg=d`;

    const options: { text: string; onPress: () => void }[] = [
      {
        text: 'Waze',
        onPress: () => openUrl(wazeUrl, googleFallback),
      },
      {
        text: 'Google Maps',
        onPress: () => openUrl(googleUrlNative, googleFallback),
      },
    ];

    if (Platform.OS === 'ios') {
      options.push({
        text: 'Apple Maps',
        onPress: () => openUrl(appleUrl, googleFallback),
      });
    }

    Alert.alert('Atvērt navigāciju', label, [
      ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
      { text: 'Atcelt', style: 'cancel' as const },
    ]);
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
    haptics.medium();

    // AT_DELIVERY → DELIVERED requires delivery proof (photo + signature)
    if (currentStatus === 'AT_DELIVERY') {
      router.push({ pathname: '/delivery-proof', params: { jobId: job.id } });
      return;
    }

    // AT_PICKUP → LOADED requires weight ticket reading
    if (currentStatus === 'AT_PICKUP') {
      setWeightInput('');
      setPickupPhotoUri(null);
      setWeightModalVisible(true);
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
            haptics.success();
          } catch (err: any) {
            haptics.error();
            Alert.alert('Kļūda', err.message ?? 'Neizdevās atjaunināt statusu');
          }
        },
      },
    ]);
  };

  const handleWeightConfirm = async () => {
    if (!token || !job) return;
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (!kg || kg <= 0 || isNaN(kg)) {
      Alert.alert('Kļūda', 'Ievadiet derīgu svaru kilogramos.');
      return;
    }
    setWeightSubmitting(true);
    try {
      const updated = await api.transportJobs.updateStatus(job.id, 'LOADED', token, kg);
      setJob(updated);
      setWeightModalVisible(false);
      haptics.success();
    } catch (err: any) {
      haptics.error();
      Alert.alert('Kļūda', err.message ?? 'Neizdevās atjaunināt statusu');
    } finally {
      setWeightSubmitting(false);
    }
  };

  return (
    <ScreenContainer bg="#f9fafb">
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.activeJob.title}</Text>
          <TouchableOpacity
            style={styles.chatHeaderBtn}
            onPress={() =>
              router.push({
                pathname: '/chat/[jobId]',
                params: { jobId: job.id, title: 'Pasūtītājs' },
              })
            }
            activeOpacity={0.7}
          >
            <MessageCircle size={20} color="#111827" />
          </TouchableOpacity>
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
          {/* Phase badge + label */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: phaseColor.bg, borderColor: phaseColor.border },
              ]}
            >
              <Text style={[styles.statusText, { color: phaseColor.text }]}>
                {t.activeJob.status[currentStatus] ?? currentStatus}
              </Text>
            </View>
            <Text style={[styles.phaseLabel, { color: phaseColor.text }]}>{phaseColor.phase}</Text>
          </View>

          {/* Progress stepper — phase-colored with animated pulse on active dot */}
          <View style={styles.progressBar}>
            {STATUS_STEPS.map((step, i) => {
              const isDone = i < currentIndex;
              const isActive = i === currentIndex;
              // Steps 0-3 = pickup phase (amber), 4-6 = delivery phase (green)
              const dotColor = i < 4 ? '#d97706' : '#059669';
              return (
                <React.Fragment key={step}>
                  {isActive ? (
                    <Animated.View
                      style={[
                        styles.progressDot,
                        styles.progressDotActive,
                        { backgroundColor: dotColor, transform: [{ scale: pulseAnim }] },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.progressDot,
                        isDone
                          ? [styles.progressDotDone, { backgroundColor: dotColor }]
                          : undefined,
                      ]}
                    />
                  )}
                  {i < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        isDone ? { backgroundColor: i < 3 ? '#d97706' : '#059669' } : undefined,
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
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
              <CheckCircle2 size={20} color="#111827" />
              <Text style={styles.completedText}>Piegādāts!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Weight Ticket Modal ── */}
      <BottomSheet
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        title="⚖️ Svēršanas biļete"
        subtitle="Ievadiet faktisko svēršanas rādījumu (kg), pirms atzīmēt kravu kā iekrauta."
        scrollable
      >
        <View style={{ gap: 14, paddingBottom: 8 }}>
          {/* Photo capture */}
          <TouchableOpacity
            style={[styles.photoCapture, pickupPhotoUri ? styles.photoCaptured : null]}
            onPress={handleTakePickupPhoto}
            activeOpacity={0.8}
          >
            {pickupPhotoUri ? (
              <View style={styles.photoPreview}>
                <Image
                  source={{ uri: pickupPhotoUri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
                <View style={styles.photoCheck}>
                  <CheckCircle size={14} color="#111827" />
                  <Text style={styles.photoCheckText}>Foto uzņemts</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoPicker}>
                <Camera size={22} color="#6b7280" />
                <Text style={styles.photoPickerText}>Fotografēt svēršanas biļeti</Text>
                <Text style={styles.photoPickerHint}>Ieteicams, bet neobligāts</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInput}
              keyboardType="decimal-pad"
              placeholder="piem. 18500"
              placeholderTextColor="#9ca3af"
              value={weightInput}
              onChangeText={setWeightInput}
              autoFocus
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
          {job?.cargoWeight != null && (
            <Text style={styles.weightHint}>
              Paredzētais svars: {(job.cargoWeight * 1000).toFixed(0)} kg ({job.cargoWeight} t)
            </Text>
          )}
          <View style={styles.weightActions}>
            <TouchableOpacity
              style={styles.weightCancel}
              onPress={() => setWeightModalVisible(false)}
            >
              <Text style={styles.weightCancelText}>Atcelt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weightConfirm, weightSubmitting && { opacity: 0.6 }]}
              onPress={handleWeightConfirm}
              disabled={weightSubmitting}
            >
              <Text style={styles.weightConfirmText}>
                {weightSubmitting ? 'Saglabā...' : 'Apstiprināt iekraušanu'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </ScreenContainer>
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
    backgroundColor: '#111827',
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
  statusText: { color: '#111827', fontWeight: '700', fontSize: 14 },
  phaseLabel: { fontSize: 12, fontWeight: '600' },

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
  },
  progressDotActive: {
    backgroundColor: '#111827',
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: '#111827',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  progressDotDone: { backgroundColor: '#111827' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },
  progressLineDone: { backgroundColor: '#111827' },

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
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#fecaca',
  },
  routeDotEnd: { backgroundColor: '#111827', borderColor: '#bbf7d0' },
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
  callBtnActive: { backgroundColor: '#111827' },
  callBtnText: { fontSize: 18 },

  actionsRow: { gap: 10 },
  navigateBtn: {
    backgroundColor: '#374151',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navigateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnProof: {
    backgroundColor: '#111827',
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
  completedText: { color: '#111827', fontWeight: '700', fontSize: 16 },

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
  returnStripDesc: { fontSize: 12, color: '#374151', marginTop: 4 },
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
  goBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Weight Ticket Modal ────────────────────────────────────────
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  weightInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 12,
  },
  weightUnit: { fontSize: 18, fontWeight: '600', color: '#6b7280' },
  weightHint: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  weightActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  weightCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  weightCancelText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  weightConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  weightConfirmText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  // Photo capture
  photoCapture: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  photoCaptured: {
    borderColor: '#111827',
    borderStyle: 'solid',
    backgroundColor: '#f0fdf4',
  },
  photoPicker: { alignItems: 'center', gap: 6 },
  photoPickerText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  photoPickerHint: { fontSize: 12, color: '#9ca3af' },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoThumb: { width: 72, height: 72, borderRadius: 8 },
  photoCheck: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoCheckText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  chatHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
