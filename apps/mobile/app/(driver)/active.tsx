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
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  ApiTransportJob,
  ApiReturnTripJob,
  ApiTransportJobException,
  TransportExceptionType,
} from '@/lib/api';
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
  AlertTriangle,
  Clock,
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

const EXCEPTION_TYPE_OPTIONS: Array<{ value: TransportExceptionType; label: string }> = [
  { value: 'DRIVER_NO_SHOW', label: 'Šoferis neieradās' },
  { value: 'SUPPLIER_NOT_READY', label: 'Piegādātājs nav gatavs' },
  { value: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
  { value: 'PARTIAL_DELIVERY', label: 'Daļēja piegāde' },
  { value: 'REJECTED_DELIVERY', label: 'Piegāde atteikta' },
  { value: 'SITE_CLOSED', label: 'Objekts slēgts' },
  { value: 'OVERWEIGHT', label: 'Pārsniegts svars' },
  { value: 'OTHER', label: 'Cits' },
];

const SLA_STAGE_LABEL: Record<string, string> = {
  PICKUP_DELAY: 'Kavēta iekraušana',
  DELIVERY_DELAY: 'Kavēta piegāde',
};

const DOC_LABELS: Record<string, string> = {
  DELIVERY_PROOF: 'Piegādes apliecinājums',
  WEIGHING_SLIP: 'Svēršanas biļete',
};

function formatDocCode(code: string): string {
  return DOC_LABELS[code] ?? code.replaceAll('_', ' ').toLowerCase();
}

export default function ActiveJobScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const toast = useToast();
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
  const [deliveryBlockers, setDeliveryBlockers] = React.useState<string[]>([]);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const [exceptions, setExceptions] = React.useState<ApiTransportJobException[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = React.useState(false);
  const [exceptionType, setExceptionType] = React.useState<TransportExceptionType>('OTHER');
  const [exceptionNotes, setExceptionNotes] = React.useState('');
  const [reportingException, setReportingException] = React.useState(false);
  const [resolvingExceptionId, setResolvingExceptionId] = React.useState<string | null>(null);
  const [resolutionById, setResolutionById] = React.useState<Record<string, string>>({});

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
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPickupPhotoUri(uri);
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
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Neizdevās ielādēt atgriešanās darbus');
        setReturnTrips([]);
      })
      .finally(() => setReturnTripsLoading(false));
  }, [token, job?.status, job?.deliveryLat, job?.deliveryLng]);

  // ── Readiness check before AT_DELIVERY → DELIVERED ───────────
  useEffect(() => {
    let active = true;
    if (!token || !job?.id || job.status !== 'AT_DELIVERY') {
      setDeliveryBlockers([]);
      setReadinessLoading(false);
      return;
    }
    setReadinessLoading(true);
    api.transportJobs
      .documentReadiness(job.id, token)
      .then((readiness) => {
        if (!active) return;
        setDeliveryBlockers(readiness.missing.filter((doc) => doc !== 'DELIVERY_PROOF'));
      })
      .catch(() => {
        if (!active) return;
        setDeliveryBlockers([]);
      })
      .finally(() => {
        if (active) setReadinessLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, job?.id, job?.status]);

  useEffect(() => {
    let active = true;
    if (!token || !job?.id) {
      setExceptions([]);
      setExceptionsLoading(false);
      return;
    }

    setExceptionsLoading(true);
    api.transportJobs
      .listExceptions(job.id, token)
      .then((data) => {
        if (!active) return;
        setExceptions(data);
      })
      .catch(() => {
        if (!active) return;
        setExceptions([]);
      })
      .finally(() => {
        if (active) setExceptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, job?.id]);

  const handleReportException = async () => {
    if (!token || !job) return;
    const trimmed = exceptionNotes.trim();
    if (!trimmed) {
      Alert.alert('Norādiet piezīmes', 'Lūdzu aprakstiet situāciju pirms iesniegšanas.');
      return;
    }

    setReportingException(true);
    try {
      const created = await api.transportJobs.reportException(
        job.id,
        {
          type: exceptionType,
          notes: trimmed,
        },
        token,
      );
      setExceptions((prev) => [created, ...prev]);
      setExceptionNotes('');
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās iesniegt izņēmumu');
    } finally {
      setReportingException(false);
    }
  };

  const handleResolveException = async (exceptionId: string) => {
    if (!token || !job) return;
    const resolution = resolutionById[exceptionId]?.trim() || 'Atrisināts aktīvā darba ekrānā';
    setResolvingExceptionId(exceptionId);
    try {
      const resolved = await api.transportJobs.resolveException(
        job.id,
        exceptionId,
        resolution,
        token,
      );
      setExceptions((prev) => prev.map((item) => (item.id === exceptionId ? resolved : item)));
      setResolutionById((prev) => ({ ...prev, [exceptionId]: '' }));
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atrisināt izņēmumu');
    } finally {
      setResolvingExceptionId(null);
    }
  };

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
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās pieņemt darbu');
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
      toast.error(e instanceof Error ? e.message : 'Neizdevās ielādēt darbu');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchActiveJob();
    }, [fetchActiveJob]),
  );

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
      <ScreenContainer bg="#f2f2f7">
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#f2f2f7">
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
  const openExceptions = exceptions.filter((ex) => ex.status === 'OPEN');

  const slaTone = job.sla?.isOverdue
    ? {
        bg: '#fef2f2',
        border: '#fecaca',
        title: '#991b1b',
        body: '#7f1d1d',
      }
    : {
        bg: '#eff6ff',
        border: '#bfdbfe',
        title: '#1d4ed8',
        body: '#1e40af',
      };

  const phaseColor =
    currentStatus === 'DELIVERED'
      ? { bg: '#dcfce7', border: '#86efac', text: '#15803d', phase: 'Piegādāts ✓' }
      : currentIndex >= 4
        ? { bg: '#d1fae5', border: '#6ee7b7', text: '#000000', phase: 'Piegādes fāze' }
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
      if (readinessLoading) {
        Alert.alert('Lūdzu uzgaidiet', 'Pārbaudām dokumentu gatavību.');
        return;
      }
      if (deliveryBlockers.length > 0) {
        Alert.alert(
          'Trūkst obligāti dokumenti',
          `Pirms piegādes apstiprināšanas augšupielādējiet: ${deliveryBlockers
            .map(formatDocCode)
            .join(', ')}`,
        );
        return;
      }
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
          } catch (err: unknown) {
            haptics.error();
            Alert.alert(
              'Kļūda',
              err instanceof Error ? err.message : 'Neizdevās atjaunināt statusu',
            );
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
      const updated = await api.transportJobs.updateStatus(
        job.id,
        'LOADED',
        token,
        kg,
        pickupPhotoUri ?? undefined,
      );
      setJob(updated);
      setWeightModalVisible(false);
      setPickupPhotoUri(null);
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atjaunināt statusu');
    } finally {
      setWeightSubmitting(false);
    }
  };

  return (
    <ScreenContainer bg="#ffffff">
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140, paddingTop: 0 }]}>
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
                showToPickupLeg={
                  currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'
                }
                height={280}
                borderRadius={0}
                style={styles.mapCard}
              />
            )}

          {/* Floating Job info */}
          <View style={styles.floatingDetails}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View>
                <Text
                  style={{ fontSize: 24, fontWeight: '700', color: '#000000', letterSpacing: -0.5 }}
                >
                  #{job.jobNumber}
                </Text>
                <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 4, fontWeight: '500' }}>
                  {job.cargoType} · {job.cargoWeight ?? 0}t
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                  <Text style={styles.price}>€{job.rate.toFixed(2)}</Text>
                </View>
              </View>
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
            </View>

            <Text
              style={[styles.phaseLabel, { color: phaseColor.text, marginTop: 4, marginBottom: 8 }]}
            >
              {phaseColor.phase}
            </Text>

            {/* SLA Alert only if overdue */}
            {job.sla?.isOverdue && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fef2f2',
                  padding: 12,
                  borderRadius: 8,
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <AlertTriangle size={16} color="#ef4444" />
                <Text style={{ color: '#b91c1c', fontWeight: '600', fontSize: 13 }}>
                  {SLA_STAGE_LABEL[job.sla.stage ?? ''] ?? 'Kavējums'} · {job.sla.overdueMinutes}{' '}
                  min
                </Text>
              </View>
            )}

            <View style={styles.routeSection}>
              {/* From */}
              <View style={styles.routeRow}>
                <View style={styles.routeDot} />
                <View style={styles.routeInfo}>
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
                  <Text style={styles.routeValue}>
                    {job.deliveryAddress}, {job.deliveryCity}
                  </Text>
                  {job.order?.siteContactName ? (
                    <Text style={styles.siteContactName}>{job.order.siteContactName}</Text>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[jobId]',
                        params: { jobId: job.id, title: 'Pasūtītājs' },
                      })
                    }
                  >
                    <MessageCircle size={18} color="#374151" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.callBtn,
                      job.order?.siteContactPhone ? styles.callBtnActive : undefined,
                    ]}
                    onPress={() =>
                      handleCall(job.order?.siteContactPhone, job.order?.siteContactName)
                    }
                  >
                    <Phone size={18} color={job.order?.siteContactPhone ? '#ffffff' : '#374151'} />
                  </TouchableOpacity>
                </View>
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
                    <Route size={16} color="#000000" />
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
                  <ActivityIndicator size="small" color="#000000" style={{ marginVertical: 8 }} />
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
                            <Route size={10} color="#000000" />
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

          {/* Exceptions widget */}
          <View style={styles.exceptionCard}>
            <View style={styles.exceptionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={17} color="#000000" />
                <Text style={styles.exceptionTitle}>Izņēmumi</Text>
              </View>
              <View style={styles.exceptionCountPill}>
                <Text style={styles.exceptionCountPillText}>{openExceptions.length} atvērti</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exceptionTypeRow}
            >
              {EXCEPTION_TYPE_OPTIONS.map((option) => {
                const selected = option.value === exceptionType;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.exceptionTypeChip, selected && styles.exceptionTypeChipActive]}
                    onPress={() => setExceptionType(option.value)}
                  >
                    <Text
                      style={[
                        styles.exceptionTypeChipText,
                        selected && styles.exceptionTypeChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.exceptionInput}
              multiline
              value={exceptionNotes}
              onChangeText={setExceptionNotes}
              placeholder="Aprakstiet situāciju dispečeram un klientam"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={[styles.exceptionReportBtn, reportingException && { opacity: 0.65 }]}
              onPress={handleReportException}
              disabled={reportingException}
            >
              {reportingException ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.exceptionReportBtnText}>Ziņot par izņēmumu</Text>
              )}
            </TouchableOpacity>

            {exceptionsLoading ? (
              <ActivityIndicator size="small" color="#6b7280" style={{ marginTop: 8 }} />
            ) : exceptions.length === 0 ? (
              <Text style={styles.exceptionEmptyText}>Pašlaik nav reģistrētu izņēmumu.</Text>
            ) : (
              <View style={styles.exceptionList}>
                {exceptions.map((item) => {
                  const isOpen = item.status === 'OPEN';
                  return (
                    <View key={item.id} style={styles.exceptionItem}>
                      <View style={styles.exceptionItemHead}>
                        <Text style={styles.exceptionItemType}>{item.type}</Text>
                        <Text
                          style={[
                            styles.exceptionItemStatus,
                            isOpen ? styles.exceptionOpen : styles.exceptionResolved,
                          ]}
                        >
                          {isOpen ? 'ATVĒRTS' : 'ATRISINĀTS'}
                        </Text>
                      </View>
                      <Text style={styles.exceptionItemNotes}>{item.notes}</Text>
                      {isOpen && (
                        <>
                          <TextInput
                            style={styles.exceptionResolutionInput}
                            value={resolutionById[item.id] ?? ''}
                            onChangeText={(value) =>
                              setResolutionById((prev) => ({ ...prev, [item.id]: value }))
                            }
                            placeholder="Atrisinājuma komentārs"
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity
                            style={[
                              styles.exceptionResolveBtn,
                              resolvingExceptionId === item.id && { opacity: 0.65 },
                            ]}
                            onPress={() => handleResolveException(item.id)}
                            disabled={resolvingExceptionId === item.id}
                          >
                            {resolvingExceptionId === item.id ? (
                              <ActivityIndicator size="small" color="#111827" />
                            ) : (
                              <Text style={styles.exceptionResolveBtnText}>
                                Atzīmēt kā atrisinātu
                              </Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Actions */}
          {currentStatus === 'AT_DELIVERY' && deliveryBlockers.length > 0 && (
            <View style={styles.readinessWarning}>
              <Text style={styles.readinessWarningTitle}>Trūkst obligāti dokumenti</Text>
              <Text style={styles.readinessWarningText}>
                Piegādi nevar pabeigt, kamēr nav iesniegti visi dokumenti.
              </Text>
              <Text style={styles.readinessWarningList}>
                {deliveryBlockers.map(formatDocCode).join(' • ')}
              </Text>
            </View>
          )}
        </ScrollView>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            ...styles.actionsRow,
          }}
        >
          <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Navigation2 size={18} color="#000000" />
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
      </View>

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
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: 20, gap: 16 },
  mapCard: {
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: -20,
    marginTop: -16,
    overflow: 'hidden',
  },

  price: { color: '#000000', fontWeight: '800', fontSize: 28, letterSpacing: -1 },

  floatingDetails: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
  },
  progressDotActive: {
    backgroundColor: '#000000',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDotDone: { backgroundColor: '#000000' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },
  progressLineDone: { backgroundColor: '#000000' },

  routeSection: { gap: 0, marginTop: 16 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#9ca3af',
    backgroundColor: '#ffffff',
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  routeLine: { width: 2, height: 32, backgroundColor: '#e5e7eb', marginLeft: 4 },
  routeInfo: { flex: 1, paddingLeft: 4 },
  routeValue: { fontSize: 18, fontWeight: '700', color: '#000000', letterSpacing: -0.3 },
  siteContactName: { fontSize: 14, color: '#6b7280', marginTop: 4, fontWeight: '500' },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnActive: { backgroundColor: '#000000' },
  callBtnText: { fontSize: 18 },

  exceptionCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
  },
  exceptionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exceptionTitle: { fontSize: 15, fontWeight: '700', color: '#000000' },
  exceptionCountPill: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  exceptionCountPillText: { fontSize: 11, color: '#ffffff', fontWeight: '700' },
  exceptionTypeRow: { gap: 8, paddingRight: 4 },
  exceptionTypeChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  exceptionTypeChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  exceptionTypeChipText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  exceptionTypeChipTextActive: { color: '#ffffff' },
  exceptionInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#f9fafb',
  },
  exceptionReportBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exceptionReportBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exceptionEmptyText: { fontSize: 13, color: '#6b7280' },
  exceptionList: { gap: 12 },
  exceptionItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    backgroundColor: '#f9fafb',
  },
  exceptionItemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exceptionItemType: { fontSize: 14, fontWeight: '700', color: '#000000' },
  exceptionItemStatus: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exceptionOpen: { color: '#dc2626' },
  exceptionResolved: { color: '#16a34a' },
  exceptionItemNotes: { fontSize: 14, color: '#4b5563' },
  exceptionResolutionInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  exceptionResolveBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exceptionResolveBtnText: { fontSize: 13, color: '#ffffff', fontWeight: '700' },

  readinessWarning: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  readinessWarningTitle: { fontSize: 15, fontWeight: '700', color: '#b45309' },
  readinessWarningText: { fontSize: 14, color: '#92400e' },
  readinessWarningList: { fontSize: 14, color: '#b45309', fontWeight: '700' },

  actionsRow: { gap: 12 },
  navigateBtn: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navigateBtnText: { color: '#000000', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnProof: {
    backgroundColor: '#000000',
  },
  nextBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  completedBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  completedText: { color: '#000000', fontWeight: '700', fontSize: 16 },

  returnStrip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    gap: 8,
  },
  returnStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  returnStripTitle: { fontSize: 15, fontWeight: '700', color: '#000000' },
  returnCountPill: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  returnCountPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  returnStripDismiss: { fontSize: 16, color: '#9ca3af', paddingLeft: 8 },
  returnStripDesc: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  returnMiniCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    width: 220,
    marginRight: 6,
  },
  returnMiniKmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  returnMiniKmText: { fontSize: 12, fontWeight: '700', color: '#000000' },
  returnMiniRoute: { fontSize: 14, fontWeight: '700', color: '#000000', marginTop: 8 },
  returnMiniWeight: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  returnMiniPrice: { fontSize: 16, fontWeight: '800', color: '#000000', marginTop: 8 },
  returnMiniAcceptBtn: {
    marginTop: 12,
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  returnMiniAcceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  returnStripCta: { marginTop: 12 },
  returnStripCtaText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  goBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  weightInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    paddingVertical: 12,
  },
  weightUnit: { fontSize: 18, fontWeight: '700', color: '#9ca3af' },
  weightHint: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  weightActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  weightCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  weightCancelText: { fontSize: 15, fontWeight: '700', color: '#000000' },
  weightConfirm: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  weightConfirmText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  photoCapture: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  photoCaptured: {
    borderColor: '#000000',
    borderStyle: 'solid',
  },
  photoPicker: { alignItems: 'center', gap: 8 },
  photoPickerText: { fontSize: 15, fontWeight: '700', color: '#000000' },
  photoPickerHint: { fontSize: 13, color: '#6b7280' },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoCheck: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoCheckText: { fontSize: 14, fontWeight: '700', color: '#000000' },
  chatHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
