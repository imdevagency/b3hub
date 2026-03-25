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
  ArrowLeft,
  HelpCircle,
  MapPin,
  User,
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

  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

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
    <ScreenContainer bg="transparent" topInset={0} style={{ flex: 1 }} noAnimation>
      {/* ── Absolutely Positioned Map Layer ── */}
      <View style={StyleSheet.absoluteFill}>
        {job.pickupLat != null &&
        job.pickupLng != null &&
        job.deliveryLat != null &&
        job.deliveryLng != null ? (
          <JobRouteMap
            pickup={{
              lat: job.pickupLat,
              lng: job.pickupLng,
              label: job.pickupCity || '',
            }}
            delivery={{
              lat: job.deliveryLat,
              lng: job.deliveryLng,
              label: job.deliveryCity || '',
            }}
            current={
              currentLat != null && currentLng != null ? { lat: currentLat, lng: currentLng } : null
            }
            showToPickupLeg={currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'}
            height={null}
            borderRadius={0}
            style={{ flex: 1 }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: '#eaedf2',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <MapPin size={36} color="#9ca3af" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#9ca3af',
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              {currentStatus === 'ACCEPTED' ||
              currentStatus === 'EN_ROUTE_PICKUP' ||
              currentStatus === 'AT_PICKUP'
                ? `${job.pickupAddress ?? ''}, ${job.pickupCity ?? ''}`
                : `${job.deliveryAddress ?? ''}, ${job.deliveryCity ?? ''}`}
            </Text>
          </View>
        )}
      </View>

      {/* ── Top Bar Overlay ── */}
      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>

        {/* SLA Warning Status */}
        {job.sla?.isOverdue && (
          <View
            style={{
              backgroundColor: '#fef2f2',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Clock size={16} color="#dc2626" />
            <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13 }}>
              -{job.sla.overdueMinutes} min
            </Text>
          </View>
        )}
      </View>

      {/* ── Bottom Sheet Overlay ── */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />

        {/* ── Step progress ── */}
        <View style={{ flexDirection: 'row', gap: 3, marginBottom: 14 }}>
          {STATUS_STEPS.map((step, i) => (
            <View
              key={step}
              style={{
                flex: i === currentIndex ? 2 : 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: i <= currentIndex ? '#111827' : '#e5e7eb',
                opacity: i < currentIndex ? 0.3 : 1,
              }}
            />
          ))}
        </View>

        {/* Minimal Header: Phase */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: phaseColor.bg }]}>
            <Text style={[styles.statusPillText, { color: phaseColor.text }]}>
              {currentStatus === 'EN_ROUTE_PICKUP'
                ? 'CEĻĀ UZ IEKRAUŠANU'
                : currentStatus === 'EN_ROUTE_DELIVERY'
                  ? 'CEĻĀ UZ IZKRAUŠANU'
                  : (t.activeJob.status[currentStatus] ?? currentStatus)}
            </Text>
          </View>
          <Text style={styles.jobIdText}>#{job.jobNumber}</Text>
        </View>

        {/* Main Context: Title & Address */}
        <Text style={styles.sheetTitle} numberOfLines={1} adjustsFontSizeToFit>
          {currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'
            ? 'Dodies uz iekraušanu'
            : currentStatus === 'AT_PICKUP'
              ? 'Iekraušana objektā'
              : currentStatus === 'LOADED' || currentStatus === 'EN_ROUTE_DELIVERY'
                ? 'Dodies uz izkraušanu'
                : 'Piegāde objektā'}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <MapPin size={16} color="#6b7280" />
          <Text style={styles.sheetAddress} numberOfLines={1}>
            {currentStatus === 'ACCEPTED' ||
            currentStatus === 'EN_ROUTE_PICKUP' ||
            currentStatus === 'AT_PICKUP'
              ? `${job.pickupAddress}, ${job.pickupCity}`
              : `${job.deliveryAddress}, ${job.deliveryCity}`}
          </Text>
        </View>

        {/* Primary Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
            <Navigation2 size={24} color="#000" />
          </TouchableOpacity>

          {nextStatus ? (
            <TouchableOpacity style={[styles.primaryButton]} onPress={handleUpdateStatus}>
              <Text style={styles.primaryButtonText}>
                {currentStatus === 'AT_DELIVERY'
                  ? t.deliveryProof.title
                  : currentStatus === 'AT_PICKUP'
                    ? 'Apstiprināt kravu'
                    : t.activeJob.status[nextStatus]}
              </Text>
              {currentStatus !== 'AT_DELIVERY' && (
                <Text style={{ color: '#ffffff80', fontSize: 18 }}>→</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.completedBanner}>
              <CheckCircle2 size={20} color="#365314" />
              <Text style={styles.completedText}>Piegādāts!</Text>
            </View>
          )}
        </View>

        {/* Expandable Details Trigger */}
        <TouchableOpacity
          style={styles.detailsTrigger}
          onPress={() => setDetailsExpanded(!detailsExpanded)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.detailsTriggerText}>
              {detailsExpanded ? 'Slēpt detaļas' : 'Rādīt detaļas & Izņēmumus'}
            </Text>
            {!detailsExpanded && openExceptions.length > 0 && (
              <View
                style={{
                  backgroundColor: '#dc2626',
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {openExceptions.length}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Details Content */}
        {detailsExpanded && (
          <ScrollView
            style={styles.expandedContent}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Saziņa Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  { flex: 1, backgroundColor: '#f0fdf4', height: 48, flexDirection: 'row', gap: 8 },
                ]}
                onPress={() => handleCall(job.order?.siteContactPhone, job.order?.siteContactName)}
              >
                <Phone size={18} color="#16a34a" />
                <Text style={{ color: '#16a34a', fontWeight: '600' }}>Zvanīt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  { flex: 1, backgroundColor: '#eff6ff', height: 48, flexDirection: 'row', gap: 8 },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[jobId]',
                    params: { jobId: job.id, title: 'Pasūtītājs' },
                  })
                }
              >
                <MessageCircle size={18} color="#2563eb" />
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Čats</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Materiāls</Text>
              <Text style={styles.detailValue}>{job.cargoType}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Svars</Text>
              <Text style={styles.detailValue}>{job.cargoWeight ?? '-'} t</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cena</Text>
              <Text style={styles.detailValue}>€{job.rate.toFixed(2)}</Text>
            </View>

            {/* Exceptions Entry Point */}
            <Text style={[styles.detailLabel, { marginTop: 16, marginBottom: 8 }]}>
              Izņēmumi / Problēmas
            </Text>
            <View style={styles.exceptionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#ef4444" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#7f1d1d' }}>
                  Ziņot par problēmu
                </Text>
              </View>
              <TextInput
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 8,
                  padding: 8,
                  height: 60,
                  fontSize: 13,
                }}
                placeholder="Aprakstiet situāciju..."
                value={exceptionNotes}
                onChangeText={setExceptionNotes}
                multiline
              />
              <TouchableOpacity
                style={{
                  backgroundColor: '#fee2e2',
                  borderRadius: 8,
                  padding: 10,
                  alignItems: 'center',
                }}
                onPress={handleReportException}
              >
                <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 13 }}>
                  Ziņot dispečeram
                </Text>
              </TouchableOpacity>
            </View>

            {/* Return Trips List (if any) */}
            {returnTrips.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
                >
                  <Route size={16} color="#000" />
                  <Text style={{ fontWeight: '700', fontSize: 14 }}>Atpakaļceļa kravas</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {returnTrips.map((rt) => (
                    <View
                      key={rt.id}
                      style={{
                        width: 220,
                        padding: 12,
                        backgroundColor: '#f3f4f6',
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ fontWeight: '700', fontSize: 14 }}>
                        €{rt.rate.toFixed(0)} · {rt.returnDistanceKm} km
                      </Text>
                      <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        {rt.pickupCity} → {rt.deliveryCity}
                      </Text>
                      <TouchableOpacity
                        style={{
                          marginTop: 8,
                          backgroundColor: '#000',
                          padding: 8,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                        onPress={() =>
                          handleAcceptReturnTrip(rt.id, rt.pickupCity, rt.deliveryCity)
                        }
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                          Pieņemt
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Weight Ticket Modal (Original) ── */}
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
  // New minimal styles
  container: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    top: 60, // Safe area approx
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align to top
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  roundButton: {
    // Alias for iconButton
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40, // Home indicator space
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  jobIdText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sheetAddress: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  mainInfo: { marginBottom: 20 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionRow: {
    // Keep for back-compat if needed
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButtonSecondary: {
    width: 80,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#1f2937', marginTop: 2 },
  actionButtonPrimary: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  navButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  completedBanner: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#ecfccb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#84cc16',
  },
  completedText: {
    color: '#365314',
    fontWeight: '700',
    fontSize: 16,
  },
  detailsTrigger: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 8,
  },
  detailsTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  expandedContent: {
    marginTop: 0,
    paddingTop: 8,
    maxHeight: 320,
  },
  contactRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  contactButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    height: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  contactText: { fontWeight: '600', color: '#1f2937' },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  exceptionCard: {
    marginTop: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 12,
  },
  exceptionTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  // Weight Modal
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
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
    color: '#000',
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
  weightCancelText: { fontSize: 15, fontWeight: '700', color: '#000' },
  weightConfirm: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  weightConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  photoCapture: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  photoCaptured: { borderStyle: 'solid', borderColor: '#000' },
  photoPicker: { alignItems: 'center', gap: 8 },
  photoPickerText: { fontSize: 15, fontWeight: '700', color: '#000' },
  photoPickerHint: { fontSize: 13, color: '#6b7280' },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoCheck: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoCheckText: { fontSize: 14, fontWeight: '700', color: '#000' },
  goBtn: {
    marginTop: 24,
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  goBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
