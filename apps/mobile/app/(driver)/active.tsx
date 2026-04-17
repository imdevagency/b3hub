import React, { useEffect, useCallback, useRef } from 'react';
import {
  TextInput,
  Text as RNText,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useLiveUpdates } from '@/lib/use-live-updates';
import { BaseMap, PinLayer, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import { haptics } from '@/lib/haptics';
import { estimateCo2Kg, formatCo2 } from '@/lib/co2';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';

import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Navigation,
  Map,
  ArrowLeft,
  Phone,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  Plus,
  PlusCircle,
  FileText,
  Clock as ClockIcon,
  Star,
  MessageCircle,
  MoreHorizontal,
  ChevronRight,
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
  { value: 'SUPPLIER_NOT_READY', label: 'Piegādātājs nav gatavs' },
  { value: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
  { value: 'PARTIAL_DELIVERY', label: 'Daļēja piegāde' },
  { value: 'REJECTED_DELIVERY', label: 'Piegāde atteikta' },
  { value: 'SITE_CLOSED', label: 'Objekts slēgts' },
  { value: 'OVERWEIGHT', label: 'Pārsniegts svars' },
  { value: 'OTHER', label: 'Cits' },
];

const SURCHARGE_TYPE_OPTIONS = [
  { value: 'WAITING_TIME', label: 'Gaidīšanas laiks' },
  { value: 'FUEL', label: 'Degvielas piemaksa' },
  { value: 'OVERWEIGHT', label: 'Pārslogota krava' },
  { value: 'NARROW_ACCESS', label: 'Šaura pieeja' },
  { value: 'OTHER', label: 'Cita piemaksa' },
] as const;

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

// ── Always-on map: renders live BaseMap, overlays route+pins only when coords exist ──
function ActiveJobMap({
  job,
  currentStatus,
  currentLat,
  currentLng,
}: {
  job: ApiTransportJob;
  currentStatus: JobStatus;
  currentLat: number | null;
  currentLng: number | null;
}) {
  const cameraRef = React.useRef<CameraRefHandle | null>(null);
  const hasCoords =
    job.pickupLat != null &&
    job.pickupLng != null &&
    job.deliveryLat != null &&
    job.deliveryLng != null;

  const pickup = hasCoords ? { lat: job.pickupLat!, lng: job.pickupLng! } : null;
  const delivery = hasCoords ? { lat: job.deliveryLat!, lng: job.deliveryLng! } : null;

  const { route } = useRoute(pickup, delivery);

  const validCurrent =
    currentLat != null &&
    currentLng != null &&
    currentLat >= 34 &&
    currentLat <= 72 &&
    currentLng >= -25 &&
    currentLng <= 50
      ? { lat: currentLat, lng: currentLng }
      : null;

  const showToPickup = currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';
  const { route: toPickupRoute } = useRoute(
    showToPickup && validCurrent && pickup ? validCurrent : null,
    showToPickup && pickup ? pickup : null,
  );

  // Fit camera to show job once coords are known
  const fitted = React.useRef(false);
  React.useEffect(() => {
    if (!hasCoords || fitted.current || !cameraRef.current) return;
    const timer = setTimeout(() => {
      if (!cameraRef.current || !pickup || !delivery) return;
      cameraRef.current.fitBounds(
        [Math.max(pickup.lng, delivery.lng), Math.max(pickup.lat, delivery.lat)],
        [Math.min(pickup.lng, delivery.lng), Math.min(pickup.lat, delivery.lat)],
        [56, 56, 220, 56],
        400,
      );
      fitted.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, [hasCoords]);

  // Follow driver position
  React.useEffect(() => {
    if (!validCurrent || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [validCurrent.lng, validCurrent.lat],
      zoomLevel: 13,
      animationDuration: 700,
    });
  }, [validCurrent?.lat, validCurrent?.lng]);

  const center: [number, number] = validCurrent
    ? [validCurrent.lng, validCurrent.lat]
    : pickup && delivery
      ? [(pickup.lng + delivery.lng) / 2, (pickup.lat + delivery.lat) / 2]
      : [24.1052, 56.9496];

  const mainCoords =
    route?.coords ??
    (pickup && delivery
      ? [
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: delivery.lat, longitude: delivery.lng },
        ]
      : []);

  const toPickupCoords =
    toPickupRoute?.coords ??
    (validCurrent && pickup
      ? [
          { latitude: validCurrent.lat, longitude: validCurrent.lng },
          { latitude: pickup.lat, longitude: pickup.lng },
        ]
      : []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BaseMap cameraRef={cameraRef} center={center} zoom={12} style={StyleSheet.absoluteFill}>
        {validCurrent && <PinLayer id="current" coordinate={validCurrent} type="current" />}
        {pickup && (
          <PinLayer id="pickup" coordinate={pickup} type="pickup" label={job.pickupCity} />
        )}
        {delivery && (
          <PinLayer id="delivery" coordinate={delivery} type="delivery" label={job.deliveryCity} />
        )}
        {mainCoords.length > 1 && (
          <RouteLayer id="main-route" coordinates={mainCoords} color="#111827" width={4} />
        )}
        {toPickupCoords.length > 1 && (
          <RouteLayer
            id="to-pickup"
            coordinates={toPickupCoords}
            color="#9ca3af"
            width={3}
            dashed
          />
        )}
      </BaseMap>
    </View>
  );
}

export default function ActiveJobScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [acceptingReturnId, setAcceptingReturnId] = React.useState<string | null>(null);
  const [deliveryBlockers, setDeliveryBlockers] = React.useState<string[]>([]);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const [exceptions, setExceptions] = React.useState<ApiTransportJobException[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = React.useState(false);
  const [exceptionType, setExceptionType] = React.useState<TransportExceptionType>('OTHER');
  const [exceptionNotes, setExceptionNotes] = React.useState('');
  const [exceptionActualQty, setExceptionActualQty] = React.useState('');
  const [reportingException, setReportingException] = React.useState(false);
  const [resolvingExceptionId, setResolvingExceptionId] = React.useState<string | null>(null);
  const [resolutionById, setResolutionById] = React.useState<Record<string, string>>({});

  // Remove the hardcoded old styles and structure to start clean on bottom sheet
  const [activeTab, setActiveTab] = React.useState<'navigate' | 'details' | 'issues'>('navigate');
  const [swipeConfirmValue, setSwipeConfirmValue] = React.useState(0);
  const [returnTripsSheetVisible, setReturnTripsSheetVisible] = React.useState(false);

  // ── Weight ticket modal ──────────────────────────────────────
  const [weightModalVisible, setWeightModalVisible] = React.useState(false);
  const [weightInput, setWeightInput] = React.useState('');
  const [weightSubmitting, setWeightSubmitting] = React.useState(false);
  const [pickupPhotoUri, setPickupPhotoUri] = React.useState<string | null>(null);

  // ── Surcharge sheet ──────────────────────────────────────────
  const [surchargeSheetVisible, setSurchargeSheetVisible] = React.useState(false);
  const [surchargeType, setSurchargeType] = React.useState<string>('WAITING_TIME');
  const [surchargeAmount, setSurchargeAmount] = React.useState('');
  const [surchargeSubmitting, setSurchargeSubmitting] = React.useState(false);
  const surchargeInputRef = useRef<TextInput>(null);

  // ── Delay report sheet ───────────────────────────────────────
  const [delaySheetVisible, setDelaySheetVisible] = React.useState(false);
  const [delayMinutes, setDelayMinutes] = React.useState('30');
  const [delayReason, setDelayReason] = React.useState('');
  const [delaySubmitting, setDelaySubmitting] = React.useState(false);

  // ── Offline queue ────────────────────────────────────────────────
  const [isOffline, setIsOffline] = React.useState(false);

  // ── Buyer rating (shown after DELIVERED) ─────────────────────
  const [showBuyerRatingSheet, setShowBuyerRatingSheet] = React.useState(false);
  const [buyerRatingStars, setBuyerRatingStars] = React.useState(0);
  const [buyerRatingComment, setBuyerRatingComment] = React.useState('');
  const [buyerRatingSubmitting, setBuyerRatingSubmitting] = React.useState(false);
  const [buyerRatingDone, setBuyerRatingDone] = React.useState(false);
  const buyerRatingShownRef = React.useRef(false);

  // ── Driver self-cancel sheet ─────────────────────────────────
  const [cancelSheetVisible, setCancelSheetVisible] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelling, setCancelling] = React.useState(false);

  const flushOfflineQueue = useCallback(async () => {
    if (!token) return;
    try {
      const raw = await AsyncStorage.getItem('b3hub_offline_queue');
      if (!raw) return;
      const queue: Array<{ jobId: string; nextStatus: JobStatus; timestamp: number }> =
        JSON.parse(raw);
      if (queue.length === 0) return;
      const remaining: typeof queue = [];
      for (const item of queue) {
        try {
          const updated = await api.transportJobs.updateStatus(item.jobId, item.nextStatus, token);
          if (item.jobId === job?.id) setJob(updated);
          haptics.success();
        } catch {
          remaining.push(item);
        }
      }
      if (remaining.length === 0) {
        await AsyncStorage.removeItem('b3hub_offline_queue');
      } else {
        await AsyncStorage.setItem('b3hub_offline_queue', JSON.stringify(remaining));
      }
    } catch {
      toast.error('Neizdevās apstrādāt rindā esošos statusa atjauninājumus');
    }
  }, [token, job?.id, toast]);

  // Monitor connectivity; flush queue when back online
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOffline(!online);
      if (online) flushOfflineQueue();
    });
    return () => unsub();
  }, [flushOfflineQueue]);

  // Also flush when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') flushOfflineQueue();
    });
    return () => sub.remove();
  }, [flushOfflineQueue]);

  // Auto-show buyer rating sheet once after job reaches DELIVERED
  useEffect(() => {
    if (job?.status === 'DELIVERED' && !buyerRatingShownRef.current && token) {
      buyerRatingShownRef.current = true;
      // Small delay so the completion banner renders first
      const timer = setTimeout(async () => {
        try {
          const { rated } = await api.transportJobs.rateBuyerStatus(job.id, token);
          if (!rated) setShowBuyerRatingSheet(true);
        } catch {
          // Network error — just skip; driver can still rate later via the button
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [job?.status, job?.id, token]);

  const handleSubmitBuyerRating = async () => {
    if (!job || !token || buyerRatingStars === 0) return;
    setBuyerRatingSubmitting(true);
    try {
      await api.transportJobs.rateBuyer(
        job.id,
        { rating: buyerRatingStars, comment: buyerRatingComment.trim() || undefined },
        token,
      );
      setBuyerRatingDone(true);
      setTimeout(() => {
        setShowBuyerRatingSheet(false);
        setBuyerRatingDone(false);
        setBuyerRatingStars(0);
        setBuyerRatingComment('');
      }, 1800);
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās nosūtīt vērtējumu');
    } finally {
      setBuyerRatingSubmitting(false);
    }
  };

  const handleDriverCancel = async () => {
    if (!job || !token) return;
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      Alert.alert('Iemesls obligāts', 'Lūdzu norādiet iemeslu darba atcelšanai.');
      return;
    }
    Alert.alert(
      'Atcelt darbu?',
      'Atcelšana tiks reģistrēta. Pasūtītājs saņems paziņojumu. Vai turpināt?',
      [
        { text: 'Nē', style: 'cancel' },
        {
          text: 'Jā, atcelt',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.transportJobs.driverCancel(job.id, { reason: trimmed }, token);
              setCancelSheetVisible(false);
              setCancelReason('');
              router.replace('/(driver)/jobs');
            } catch (err: unknown) {
              Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atcelt darbu');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

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
    if (!result.canceled && result.assets[0] && job) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Kļūda', 'Neizdevās iegūt attēla datus.');
        return;
      }
      try {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const { url } = await api.transportJobs.uploadPickupPhoto(
          job.id,
          `data:${mimeType};base64,${asset.base64}`,
          mimeType,
          token!,
        );
        setPickupPhotoUri(url);
      } catch (err) {
        Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās augšupielādēt foto');
      }
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
    if (exceptionType === 'PARTIAL_DELIVERY') {
      const qty = parseFloat(exceptionActualQty);
      if (!exceptionActualQty || isNaN(qty) || qty <= 0) {
        Alert.alert(
          'Norādiet daudzumu',
          'Daļējai piegādei jānorāda faktiskais piegādātais daudzums.',
        );
        return;
      }
    }

    setReportingException(true);
    try {
      const created = await api.transportJobs.reportException(
        job.id,
        {
          type: exceptionType,
          notes: trimmed,
          ...(exceptionType === 'PARTIAL_DELIVERY' && exceptionActualQty
            ? { actualQuantity: parseFloat(exceptionActualQty) }
            : {}),
        },
        token,
      );
      setExceptions((prev) => [created, ...prev]);
      setExceptionNotes('');
      setExceptionActualQty('');
      setExceptionType('OTHER');
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
            haptics.success();
            Alert.alert('✓ Darbs pieņemts', 'Atpakaļceļa darbs pievienots jūsu darbu sarakstam.');
          } catch (err: unknown) {
            haptics.error();
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

  // ── Live status push from server ──────────────────────────────
  const { jobStatus: liveJobStatus } = useLiveUpdates({ jobId: job?.id ?? null, token });
  useEffect(() => {
    if (liveJobStatus) {
      fetchActiveJob();
    }
  }, [liveJobStatus]);

  // ── Foreground GPS watcher — live map dot only ────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 2_000,
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
    };
  }, []);

  // ── Background tracking — starts once job id is known ─────────
  useEffect(() => {
    if (!job?.id) return;
    startLocationTracking(job.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        Alert.alert(
          'GPS atļauja nepieciešama',
          'Lai izsekotu piegādi, lūdzu atļaujiet atrašanās vietas piekļuvi fonā lietotnēs iestatījumos.',
        );
      }
    });
    return () => {
      stopLocationTracking().catch(() => {});
    };
  }, [job?.id]);

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

  const phaseColor =
    currentStatus === 'DELIVERED'
      ? { bg: '#dcfce7', border: '#86efac', text: '#15803d', phase: 'Piegādāts ✓' }
      : currentIndex >= 3
        ? { bg: '#d1fae5', border: '#6ee7b7', text: '#059669', phase: 'Piegādes fāze' }
        : { bg: '#fef3c7', border: '#fde68a', text: '#d97706', phase: 'Iekraušanas fāze' };

  // ── Navigate — Schüttflix-style app picker ────────────────────────────────
  //   Shows Waze / Google Maps / Apple Maps action sheet.
  //   Always uses coordinates (not address text) for precision.
  const NAV_PREF_KEY = '@b3hub_driver_nav_app';
  type NavApp = 'waze' | 'google' | 'apple';

  const handleNavigate = () => {
    const isHeadingToPickup = currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';

    const lat = isHeadingToPickup ? (job.pickupLat ?? job.deliveryLat) : job.deliveryLat;
    const lng = isHeadingToPickup ? (job.pickupLng ?? job.deliveryLng) : job.deliveryLng;
    const label = isHeadingToPickup
      ? `${job.pickupAddress}, ${job.pickupCity}`
      : `${job.deliveryAddress}, ${job.deliveryCity}`;

    if (lat == null || lng == null) {
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

    const launch = (app: NavApp) => {
      AsyncStorage.setItem(NAV_PREF_KEY, app);
      if (app === 'waze') openUrl(wazeUrl, googleFallback);
      else if (app === 'apple') openUrl(appleUrl, googleFallback);
      else openUrl(googleUrlNative, googleFallback);
    };

    // If driver has a saved preference, launch immediately — no picker
    AsyncStorage.getItem(NAV_PREF_KEY).then((saved) => {
      if (saved === 'waze' || saved === 'google' || (saved === 'apple' && Platform.OS === 'ios')) {
        launch(saved as NavApp);
        return;
      }

      // First time — show picker and remember choice
      const options: { text: string; onPress: () => void }[] = [
        { text: 'Waze', onPress: () => launch('waze') },
        { text: 'Google Maps', onPress: () => launch('google') },
      ];
      if (Platform.OS === 'ios') {
        options.push({ text: 'Apple Maps', onPress: () => launch('apple') });
      }

      Alert.alert('Atvērt navigāciju', label, [
        ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
        { text: 'Atcelt', style: 'cancel' as const },
      ]);
    });
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
            // If offline, queue the status update for later
            const netState = await NetInfo.fetch();
            const online = netState.isConnected === true && netState.isInternetReachable !== false;
            if (!online) {
              try {
                const raw = await AsyncStorage.getItem('b3hub_offline_queue');
                const queue = raw ? JSON.parse(raw) : [];
                queue.push({ jobId: job.id, nextStatus, timestamp: Date.now() });
                await AsyncStorage.setItem('b3hub_offline_queue', JSON.stringify(queue));
                haptics.warning();
                toast.info('Offline — statuss tiks atjaunināts, kad atjaunosies savienojums');
              } catch {
                toast.error('Neizdevās saglabāt statusu rindā — lūdzu mēģiniet vēlreiz');
              }
            } else {
              haptics.error();
              Alert.alert(
                'Kļūda',
                err instanceof Error ? err.message : 'Neizdevās atjaunināt statusu',
              );
            }
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

  const handleAddSurcharge = async () => {
    if (!job || !token) return;
    const amount = parseFloat(surchargeAmount.replace(',', '.'));
    if (!amount || amount <= 0 || isNaN(amount)) {
      Alert.alert('Kļūda', 'Ievadiet derīgu summu eiro.');
      return;
    }
    setSurchargeSubmitting(true);
    try {
      await api.transportJobs.addSurcharge(job.id, { type: surchargeType, amount }, token);
      toast.success('Papildu maksa pievienota');
      setSurchargeSheetVisible(false);
      setSurchargeAmount('');
      setSurchargeType('WAITING_TIME');
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert(
        'Kļūda',
        err instanceof Error ? err.message : 'Neizdevās pievienot papildu maksu',
      );
    } finally {
      setSurchargeSubmitting(false);
    }
  };

  const handleReportDelay = async () => {
    if (!token || !job) return;
    const mins = parseInt(delayMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 480) {
      Alert.alert('Kļūda', 'Ievadiet kavēšanās laiku (1–480 minūtes).');
      return;
    }
    setDelaySubmitting(true);
    try {
      await api.transportJobs.reportDelay(
        job.id,
        { estimatedDelayMinutes: mins, reason: delayReason.trim() || undefined },
        token,
      );
      toast.success('Pasūtītājs informēts par kavēšanos');
      setDelaySheetVisible(false);
      setDelayMinutes('30');
      setDelayReason('');
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās nosūtīt paziņojumu');
    } finally {
      setDelaySubmitting(false);
    }
  };

  return (
    <ScreenContainer bg="transparent" topInset={0} style={{ flex: 1 }} noAnimation>
      {/* ── Absolutely Positioned Map Layer ── */}
      <ActiveJobMap
        job={job}
        currentStatus={currentStatus}
        currentLat={currentLat}
        currentLng={currentLng}
      />

      {/* ── Top Floating Pill ── */}
      <View
        style={[
          styles.topOverlay,
          {
            top: Math.max(insets.top + 8, 16),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[styles.iconButton, { position: 'absolute', left: 16 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>

        {/* Phase Pill at the top */}
        <View
          style={{
            backgroundColor: '#111827',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <RNText
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: '#fff',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'
              ? 'Uz iekraušanu'
              : currentStatus === 'AT_PICKUP'
                ? 'Iekraušana'
                : currentStatus === 'LOADED' || currentStatus === 'EN_ROUTE_DELIVERY'
                  ? 'Uz izkraušanu'
                  : currentStatus === 'AT_DELIVERY'
                    ? 'Piegāde'
                    : 'Pabeigts'}
          </RNText>
        </View>
      </View>

      {/* Floating Return Trips (Absolute Above Bottom Card) */}
      {returnTrips.length > 0 &&
        (currentStatus === 'EN_ROUTE_DELIVERY' || currentStatus === 'AT_DELIVERY') && (
          <View
            style={{
              position: 'absolute',
              bottom: Math.max(insets.bottom, 16) + 210,
              width: '100%',
              alignItems: 'center',
              paddingHorizontal: 16,
            }}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#111827',
                borderRadius: 24,
                paddingHorizontal: 16,
                paddingVertical: 10,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
              onPress={() => setReturnTripsSheetVisible(true)}
              activeOpacity={0.8}
            >
              <Truck size={16} color="#4ade80" />
              <RNText style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {returnTrips.length} atpakaļceļa krava{returnTrips.length > 1 ? 's' : ''} tuvumā
              </RNText>
            </TouchableOpacity>
          </View>
        )}

      {/* ── Bottom Action Card ── */}
      <View
        style={[
          styles.staticBottomCard,
          { paddingBottom: Math.max(insets.bottom, 16) + 16, paddingTop: 12 },
        ]}
      >
        {/* Pull Handle */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={styles.detailsPullHandle} />
        </View>

        {/* Address wrapped in a touchable that opens Details */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('details')}
          style={{ marginBottom: 24, paddingHorizontal: 20 }}
        >
          {/* Destination address completely minimal */}
          <RNText
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#111827',
              letterSpacing: -0.5,
              lineHeight: 32,
              marginBottom: 4,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentStatus === 'ACCEPTED' ||
            currentStatus === 'EN_ROUTE_PICKUP' ||
            currentStatus === 'AT_PICKUP'
              ? job.pickupAddress.split(',')[0]
              : job.deliveryAddress.split(',')[0]}
          </RNText>
          <RNText
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#6b7280',
            }}
            numberOfLines={1}
          >
            {currentStatus === 'ACCEPTED' ||
            currentStatus === 'EN_ROUTE_PICKUP' ||
            currentStatus === 'AT_PICKUP'
              ? job.pickupCity
              : job.deliveryCity}
          </RNText>
        </TouchableOpacity>

        {/* Primary Actions */}
        <View
          style={[
            styles.actionRow,
            { paddingHorizontal: 20, flex: 0, flexDirection: 'column', gap: 16 },
          ]}
        >
          {nextStatus ? (
            <>
              {/* Circular Secondary Actions Above Primary Button */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity
                  onPress={handleNavigate}
                  style={{ alignItems: 'center', justifyContent: 'center', gap: 6, width: 64 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Navigation size={24} color="#111827" />
                  </View>
                  <RNText style={{ fontSize: 12, color: '#4b5563', fontWeight: '600' }}>
                    Navi
                  </RNText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    handleCall(job.order?.siteContactPhone, job.order?.siteContactName)
                  }
                  style={{ alignItems: 'center', justifyContent: 'center', gap: 6, width: 64 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={24} color="#111827" />
                  </View>
                  <RNText style={{ fontSize: 12, color: '#4b5563', fontWeight: '600' }}>
                    Zvanīt
                  </RNText>
                </TouchableOpacity>

                {job?.id && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[jobId]',
                        params: {
                          jobId: job.id,
                          title: `${job.order?.orderNumber ?? job.jobNumber}`,
                        },
                      })
                    }
                    style={{ alignItems: 'center', justifyContent: 'center', gap: 6, width: 64 }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MessageCircle size={24} color="#111827" />
                    </View>
                    <RNText style={{ fontSize: 12, color: '#4b5563', fontWeight: '600' }}>
                      Čats
                    </RNText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setActiveTab('details');
                  }}
                  style={{ alignItems: 'center', justifyContent: 'center', gap: 6, width: 64 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MoreHorizontal size={24} color="#4b5563" />
                  </View>
                  <RNText style={{ fontSize: 12, color: '#4b5563', fontWeight: '600' }}>
                    Opcijas
                  </RNText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    opacity: loading ? 0.6 : 1,
                    width: '100%',
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#111827',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                  },
                ]}
                onPress={handleUpdateStatus}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <RNText style={[styles.primaryButtonText, { fontSize: 16 }]}>
                    {currentStatus === 'AT_DELIVERY'
                      ? t.deliveryProof.title
                      : currentStatus === 'AT_PICKUP'
                        ? 'Apstiprināt kravu'
                        : currentStatus === 'LOADED'
                          ? 'Dodos uz piegādi'
                          : currentStatus === 'EN_ROUTE_PICKUP'
                            ? 'Esmu iekraušanas vietā'
                            : currentStatus === 'EN_ROUTE_DELIVERY'
                              ? 'Esmu piegādes vietā'
                              : t.activeJob.status[nextStatus]}
                  </RNText>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flex: 1, gap: 10 }}>
              <View style={styles.completedBanner}>
                <CheckCircle2 size={20} color="#365314" />
                <Text style={styles.completedText}>Piegādāts!</Text>
              </View>
              <TouchableOpacity
                style={styles.findNextJobBtn}
                onPress={() => router.push('/(driver)/jobs')}
                activeOpacity={0.8}
              >
                <Text style={styles.findNextJobText}>Atrast nākamo darbu →</Text>
              </TouchableOpacity>
              {!buyerRatingDone && (
                <TouchableOpacity
                  style={styles.rateBuyerBtn}
                  onPress={() => setShowBuyerRatingSheet(true)}
                  activeOpacity={0.8}
                >
                  <Star size={15} color="#6b7280" />
                  <Text style={styles.rateBuyerBtnText}>Novērtēt pasūtītāju</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      <BottomSheet
        visible={activeTab === 'details'}
        onClose={() => setActiveTab('navigate')}
        title="Opcijas"
        scrollable
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 }}>
          {/* 1. Context First - Prominent Payout & Cargo */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
              paddingHorizontal: 4,
              gap: 16,
            }}
          >
            <View style={{ flex: 1.5, paddingRight: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  fontWeight: '700',
                  marginBottom: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Atlīdzība
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  color: '#111827',
                  letterSpacing: -1,
                  lineHeight: 36,
                  paddingVertical: 2,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                €{job.rate.toFixed(2).replace(/\.00$/, '')}
              </Text>
              {job.pricePerTonne ? (
                <Text style={{ fontSize: 13, color: '#059669', fontWeight: '700', marginTop: 2 }}>
                  €{job.pricePerTonne.toFixed(2)}/t
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Text
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  fontWeight: '700',
                  marginBottom: 2,
                  textAlign: 'right',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Krava
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#111827',
                  textAlign: 'right',
                  flexShrink: 1,
                }}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {job.cargoType}
              </Text>
              <View
                style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}
              >
                {job.cargoWeight ? (
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#4b5563',
                      fontWeight: '600',
                      textAlign: 'right',
                    }}
                  >
                    Plānotais: {job.cargoWeight}t
                  </Text>
                ) : null}
              </View>
              {job.actualWeightKg != null && (
                <Text
                  style={{
                    fontSize: 13,
                    color: '#111827',
                    fontWeight: '700',
                    marginTop: 4,
                    textAlign: 'right',
                  }}
                >
                  Faktiskais: {(job.actualWeightKg / 1000).toFixed(2)}t
                </Text>
              )}
            </View>
          </View>

          {/* Elevated Notes (if any) */}
          {job.order?.notes ? (
            <View
              style={{
                backgroundColor: '#fefce8',
                borderRadius: 16,
                padding: 16,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: '#fef08a',
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <FileText size={20} color="#ca8a04" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: '#a16207',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Piezīmes no pasūtītāja
                </Text>
                <Text style={{ fontSize: 15, color: '#854d0e', lineHeight: 22, fontWeight: '500' }}>
                  {job.order.notes}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Timeline-style Addresses */}
          <View
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: 20,
              padding: 20,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#f3f4f6',
            }}
          >
            {/* Pickup */}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ alignItems: 'center', width: 14 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#111827',
                    zIndex: 2,
                    marginTop: 6,
                  }}
                />
                <View
                  style={{
                    width: 2,
                    height: '100%',
                    backgroundColor: '#e5e7eb',
                    position: 'absolute',
                    top: 16,
                    bottom: -6,
                  }}
                />
              </View>
              <View style={{ flex: 1, paddingBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    fontWeight: '700',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {new Date(job.pickupDate).toLocaleDateString('lv-LV', {
                    day: '2-digit',
                    month: 'short',
                  })}{' '}
                  {job.pickupWindow ? `· ${job.pickupWindow}` : ''}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: '#111827',
                    letterSpacing: -0.5,
                    marginBottom: 2,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {job.pickupAddress}
                </Text>
                <Text style={{ fontSize: 15, color: '#4b5563', fontWeight: '500' }}>
                  {job.pickupCity}
                </Text>
              </View>
            </View>

            {/* Dropoff */}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ alignItems: 'center', width: 14 }}>
                {/* Dropoff visual indicator usually a square in navigation apps */}
                <View
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: '#111827',
                    zIndex: 2,
                    marginTop: 6,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    fontWeight: '700',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {new Date(job.deliveryDate).toLocaleDateString('lv-LV', {
                    day: '2-digit',
                    month: 'short',
                  })}{' '}
                  {job.deliveryWindow ? `· ${job.deliveryWindow}` : ''}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: '#111827',
                    letterSpacing: -0.5,
                    marginBottom: 2,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {job.deliveryAddress}
                </Text>
                <Text style={{ fontSize: 15, color: '#4b5563', fontWeight: '500' }}>
                  {job.deliveryCity}
                </Text>
              </View>
            </View>
          </View>

          {/* Other Info Compact */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 32,
              paddingHorizontal: 4,
            }}
          >
            {job.distanceKm != null && (
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Attālums
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 }}>
                  {job.distanceKm.toFixed(1)} km
                </Text>
              </View>
            )}
            {job.requiredVehicleType && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Auto tips
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 }}>
                  {job.requiredVehicleType}
                </Text>
              </View>
            )}
          </View>

          {/* Support Actions (Minimal) */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: '#9ca3af',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              paddingHorizontal: 4,
            }}
          >
            Darba opcijas
          </Text>

          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              overflow: 'hidden',
            }}
          >
            {(currentStatus === 'AT_PICKUP' ||
              currentStatus === 'LOADED' ||
              currentStatus === 'EN_ROUTE_DELIVERY' ||
              currentStatus === 'AT_DELIVERY') && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f3f4f6',
                }}
                onPress={() => {
                  setActiveTab('navigate');
                  setTimeout(() => setSurchargeSheetVisible(true), 260);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <PlusCircle size={20} color="#111827" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                    Pievienot papildu izmaksas
                  </Text>
                </View>
                <ChevronRight size={20} color="#d1d5db" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 18,
                borderBottomWidth:
                  currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP' ? 1 : 0,
                borderBottomColor: '#f3f4f6',
              }}
              onPress={() => {
                setActiveTab('navigate');
                setTimeout(() => setActiveTab('issues'), 260);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <AlertCircle size={20} color="#111827" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                  Ziņot par problēmu
                </Text>
              </View>
              <ChevronRight size={20} color="#d1d5db" />
            </TouchableOpacity>

            {(currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP') && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 18,
                }}
                onPress={() => {
                  setActiveTab('navigate');
                  setTimeout(() => setCancelSheetVisible(true), 260);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <AlertCircle size={20} color="#ef4444" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#ef4444' }}>
                    Atcelt darbu
                  </Text>
                </View>
                <ChevronRight size={20} color="#fecaca" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={activeTab === 'issues'}
        onClose={() => setActiveTab('navigate')}
        title="Ziņot par problēmu"
        subtitle="Ātra ziņošana dispečeram"
        scrollable
      >
        <View style={{ paddingBottom: 32 }}>
          {/* ── Existing open exceptions ── */}
          {exceptions.filter((e) => e.status === 'OPEN').length > 0 && (
            <View
              style={{
                marginBottom: 24,
                backgroundColor: '#f3f4f6',
                padding: 16,
                borderRadius: 16,
              }}
            >
              <RNText
                style={{
                  fontSize: 13,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Aktīvās problēmas
              </RNText>
              {exceptions
                .filter((e) => e.status === 'OPEN')
                .map((ex, i) => (
                  <View key={ex.id} style={{ marginTop: i > 0 ? 12 : 0 }}>
                    <RNText
                      style={{
                        fontSize: 15,
                        fontFamily: 'Inter_700Bold',
                        fontWeight: '700',
                        color: '#111827',
                      }}
                    >
                      {EXCEPTION_TYPE_OPTIONS.find((o) => o.value === ex.type)?.label ?? ex.type}
                    </RNText>
                    {ex.notes ? (
                      <RNText
                        style={{
                          fontSize: 14,
                          fontFamily: 'Inter_500Medium',
                          fontWeight: '500',
                          color: '#6b7280',
                          marginTop: 2,
                        }}
                      >
                        {ex.notes}
                      </RNText>
                    ) : null}
                  </View>
                ))}
            </View>
          )}

          {/* ── Exception type chips ── */}
          <RNText
            style={{
              fontSize: 15,
              fontFamily: 'Inter_700Bold',
              fontWeight: '700',
              color: '#111827',
              marginBottom: 12,
            }}
          >
            Problēmas veids
          </RNText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 4 }}
            style={{ marginBottom: 24, marginHorizontal: -24 }}
          >
            {EXCEPTION_TYPE_OPTIONS.map((opt) => {
              const isActive = exceptionType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setExceptionType(opt.value)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 100,
                    marginRight: 8,
                    backgroundColor: isActive ? '#111827' : '#f3f4f6',
                  }}
                >
                  <RNText
                    style={{
                      fontSize: 15,
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_600SemiBold',
                      fontWeight: isActive ? '700' : '600',
                      color: isActive ? '#ffffff' : '#374151',
                    }}
                  >
                    {opt.label}
                  </RNText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Partial delivery quantity ── */}
          {exceptionType === 'PARTIAL_DELIVERY' && (
            <View style={{ marginBottom: 24 }}>
              <RNText
                style={{
                  fontSize: 15,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 12,
                }}
              >
                Faktiskais daudzums (t)
              </RNText>
              <TextInput
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: 16,
                  padding: 16,
                  fontSize: 18,
                  fontFamily: 'Inter_600SemiBold',
                  color: '#111827',
                }}
                keyboardType="decimal-pad"
                placeholder={job.cargoWeight ? `Plānotais: ${job.cargoWeight} t` : '0 t'}
                placeholderTextColor="#9ca3af"
                value={exceptionActualQty}
                onChangeText={setExceptionActualQty}
              />
            </View>
          )}

          {/* ── Notes ── */}
          <View style={{ marginBottom: 32 }}>
            <RNText
              style={{
                fontSize: 15,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#111827',
                marginBottom: 12,
              }}
            >
              Papildu informācija
            </RNText>
            <TextInput
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 16,
                padding: 16,
                fontSize: 16,
                fontFamily: 'Inter_500Medium',
                minHeight: 120,
                color: '#111827',
                textAlignVertical: 'top',
              }}
              placeholder="Aprakstiet situāciju..."
              placeholderTextColor="#9ca3af"
              value={exceptionNotes}
              onChangeText={setExceptionNotes}
              multiline
            />
          </View>

          {/* ── Actions ── */}
          <Button
            size="lg"
            variant="default"
            className="h-16 rounded-2xl mb-4"
            onPress={handleReportException}
            disabled={reportingException}
            isLoading={reportingException}
          >
            Iesniegt ziņojumu
          </Button>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              borderRadius: 16,
            }}
            onPress={() => {
              setActiveTab('navigate');
              setTimeout(() => setDelaySheetVisible(true), 260);
            }}
          >
            <ClockIcon size={16} color="#6b7280" style={{ marginRight: 8 }} />
            <RNText
              style={{
                fontSize: 15,
                fontFamily: 'Inter_600SemiBold',
                fontWeight: '600',
                color: '#6b7280',
              }}
            >
              Vai gribējāt ziņot par kavēšanos?
            </RNText>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Surcharge Sheet ── */}

      <BottomSheet
        visible={surchargeSheetVisible}
        onClose={() => {
          setSurchargeSheetVisible(false);
          setSurchargeAmount('');
          setSurchargeType('WAITING_TIME');
        }}
        title="Papildu maksa"
        hideHandle={false}
      >
        <View style={{ paddingBottom: 32 }}>
          {/* Amount input — € is a static label, TextInput holds digits only */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
              marginBottom: 32,
            }}
          >
            <RNText
              style={{
                fontSize: 52,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: surchargeAmount ? '#111827' : '#d1d5db',
                letterSpacing: -1,
                marginRight: 4,
                lineHeight: 72,
              }}
            >
              €
            </RNText>
            <TextInput
              ref={surchargeInputRef}
              value={surchargeAmount}
              onChangeText={(text) => setSurchargeAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#d1d5db"
              maxLength={7}
              autoFocus
              style={{
                fontSize: 60,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#111827',
                letterSpacing: -2,
                minWidth: 100,
                padding: 0,
                margin: 0,
              }}
            />
          </View>

          {/* Type selector chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 4 }}
            style={{ marginBottom: 32, marginHorizontal: -24 }}
          >
            {SURCHARGE_TYPE_OPTIONS.map((opt) => {
              const isActive = surchargeType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSurchargeType(opt.value)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 100,
                    marginRight: 8,
                    backgroundColor: isActive ? '#111827' : '#f3f4f6',
                    borderWidth: 1,
                    borderColor: isActive ? '#111827' : '#e5e7eb',
                  }}
                >
                  <RNText
                    style={{
                      fontSize: 14,
                      fontWeight: isActive ? '700' : '500',
                      color: isActive ? '#fff' : '#374151',
                    }}
                  >
                    {opt.label}
                  </RNText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Confirm button */}
          <Button
            size="lg"
            className="h-20 rounded-2xl"
            onPress={handleAddSurcharge}
            disabled={surchargeSubmitting || !surchargeAmount}
            isLoading={surchargeSubmitting}
          >
            Apstiprināt maksu
          </Button>
        </View>
      </BottomSheet>

      {/* ── Delay Report Sheet ── */}
      <BottomSheet
        visible={delaySheetVisible}
        onClose={() => setDelaySheetVisible(false)}
        title="Ziņot par kavēšanos"
        subtitle="Pasūtītājs saņems paziņojumu"
      >
        <View style={{ gap: 24, paddingBottom: 32 }}>
          <View>
            <RNText
              style={{
                fontSize: 15,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#111827',
                marginBottom: 12,
              }}
            >
              Kavēšanās laiks (minūtes)
            </RNText>
            <TextInput
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 16,
                padding: 16,
                fontSize: 18,
                fontFamily: 'Inter_600SemiBold',
                color: '#111827',
              }}
              keyboardType="numeric"
              value={delayMinutes}
              onChangeText={setDelayMinutes}
              placeholder="Piem., 30"
              placeholderTextColor="#9ca3af"
              returnKeyType="done"
            />
          </View>
          <View>
            <RNText
              style={{
                fontSize: 15,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#111827',
                marginBottom: 12,
              }}
            >
              Kāpēc kavējaties? (Neobligāti)
            </RNText>
            <TextInput
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 16,
                padding: 16,
                fontSize: 16,
                fontFamily: 'Inter_500Medium',
                minHeight: 120,
                color: '#111827',
                textAlignVertical: 'top',
              }}
              value={delayReason}
              onChangeText={setDelayReason}
              placeholder="Satiksme, tehniskas problēmas..."
              placeholderTextColor="#9ca3af"
              multiline
            />
          </View>
          <Button
            size="lg"
            variant="default"
            className="h-16 rounded-2xl mt-2"
            onPress={handleReportDelay}
            disabled={delaySubmitting}
            isLoading={delaySubmitting}
          >
            Nosūtīt paziņojumu
          </Button>
        </View>
      </BottomSheet>

      {/* ── Return Trips Sheet ── */}
      <BottomSheet
        visible={returnTripsSheetVisible}
        onClose={() => setReturnTripsSheetVisible(false)}
        title="Atpakaļceļa kravas"
        subtitle={`${returnTrips.length} kravas tuvumā galamērķim`}
        scrollable
        maxHeightPct={0.75}
      >
        <View style={{ gap: 12, paddingBottom: 32 }}>
          {returnTrips.map((rt) => (
            <View
              key={rt.id}
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>
                    €{rt.rate.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                    {rt.returnDistanceKm} km
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.weightConfirm,
                    {
                      flex: 0,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      opacity: acceptingReturnId === rt.id ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => handleAcceptReturnTrip(rt.id, rt.pickupCity, rt.deliveryCity)}
                  disabled={acceptingReturnId === rt.id}
                >
                  <Text style={[styles.weightConfirmText, { fontSize: 14 }]}>
                    {acceptingReturnId === rt.id ? '...' : 'Pieņemt'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <MapPin size={13} color="#6b7280" />
                <Text style={{ fontSize: 14, color: '#374151' }}>
                  {rt.pickupCity} → {rt.deliveryCity}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </BottomSheet>

      {/* ── Weight Ticket Modal ── */}
      <BottomSheet
        visible={weightModalVisible}
        onClose={() => setWeightModalVisible(false)}
        title="Svēršanas biļete"
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
                  <CheckCircle2 size={14} color="#111827" />
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

      {/* ── Buyer Rating Sheet ── */}
      <BottomSheet
        visible={showBuyerRatingSheet}
        onClose={() => setShowBuyerRatingSheet(false)}
        scrollable
      >
        {buyerRatingDone ? (
          <View style={styles.ratingSuccessWrap}>
            <CheckCircle2 size={52} color="#111827" />
            <Text style={styles.ratingSuccessTitle}>Paldies!</Text>
            <Text style={styles.ratingSuccessSub}>Jūsu vērtējums ir saglabāts.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.ratingTitle}>Novērtēt pasūtītāju</Text>
            <Text style={styles.ratingSubtitle}>
              Kā noritēja piegāde? Tas palīdzēs uzlabot sadarbību.
            </Text>
            <View style={styles.ratingStarRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setBuyerRatingStars(n)}
                  activeOpacity={0.7}
                >
                  <Star
                    size={38}
                    color={n <= buyerRatingStars ? '#9ca3af' : '#d1d5db'}
                    fill={n <= buyerRatingStars ? '#9ca3af' : 'none'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.ratingInput}
              placeholder="Komentārs (neobligāts)"
              placeholderTextColor="#9ca3af"
              value={buyerRatingComment}
              onChangeText={setBuyerRatingComment}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.ratingSubmitBtn,
                (buyerRatingSubmitting || buyerRatingStars === 0) && { opacity: 0.5 },
              ]}
              onPress={handleSubmitBuyerRating}
              disabled={buyerRatingSubmitting || buyerRatingStars === 0}
              activeOpacity={0.85}
            >
              {buyerRatingSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.ratingSubmitBtnText}>Nosūtīt vērtējumu</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBuyerRatingSheet(false)}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>Izlaist</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* ── Driver self-cancel sheet ─────────────────────────── */}
      <BottomSheet
        visible={cancelSheetVisible}
        onClose={() => {
          setCancelSheetVisible(false);
          setCancelReason('');
        }}
        title="Atcelt darbu"
      >
        <View style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              backgroundColor: '#fef2f2',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <AlertCircle size={18} color="#dc2626" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#7f1d1d', lineHeight: 19 }}>
              Atcelšana tiks reģistrēta un pasūtītājs saņems paziņojumu. Darbs tiks atgriezts
              pieejamo sarakstā.
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
              Iemesls *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#111827',
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholder="Piemēram: mehāniska avārija, ārkārtas situācija..."
              placeholderTextColor="#9ca3af"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              maxLength={300}
            />
            <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
              {cancelReason.length}/300
            </Text>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: cancelling || !cancelReason.trim() ? '#fca5a5' : '#dc2626',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
            onPress={handleDriverCancel}
            disabled={cancelling || !cancelReason.trim()}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              {cancelling ? 'Atceļ...' : 'Apstiprināt atcelšanu'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

function InlineTab({
  label,
  active,
  onPress,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[inlineTabStyles.btn, active && inlineTabStyles.btnActive]}
      activeOpacity={0.75}
    >
      <Text style={[inlineTabStyles.text, active && inlineTabStyles.textActive]}>{label}</Text>
      {!!badge && (
        <View style={inlineTabStyles.badge}>
          <Text style={inlineTabStyles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const inlineTabStyles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnActive: { backgroundColor: '#1d4ed8' },
  text: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  textActive: { color: '#fff' },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

const styles = StyleSheet.create({
  // New minimal styles
  container: { flex: 1 },
  staticBottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 20,
  },
  detailsPull: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 0,
  },
  detailsPullHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#d1d5db',
    borderRadius: 3,
  },

  topOverlay: {
    position: 'absolute',
    // top is managed inline natively now
    left: 16,
    right: 16,
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

  gorhomBackground: {
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  gorhomHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 8,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  hudContainer: {
    position: 'absolute',
    right: 16,
    bottom: 260,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  hudButtonGroup: {
    gap: 12,
  },
  hudButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  slaBadge: {
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
  },
  slaText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

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
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.1,
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
    flexDirection: 'row',
    gap: 8,
  },
  completedText: {
    color: '#365314',
    fontWeight: '700',
    fontSize: 16,
  },
  findNextJobBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findNextJobText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  rateBuyerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  rateBuyerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  cancelJobBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    backgroundColor: '#fff5f5',
    marginTop: 8,
    marginBottom: 4,
  },
  cancelJobBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  ratingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  ratingStarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 90,
    marginBottom: 16,
  },
  ratingSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ratingSubmitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  ratingSuccessWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  ratingSuccessTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  ratingSuccessSub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontFamily: 'Inter_500Medium',
  },
  // Progress stepper
  stepperRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 16,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
  },
  stepDotDone: {
    backgroundColor: '#111827',
  },
  stepDotActive: {
    backgroundColor: '#111827',
    opacity: 1,
  },
  // Return trips chip
  returnTripsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  returnTripsChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    flex: 1,
  },
  // Report problem button
  reportProblemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
  },
  reportProblemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 48,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
    borderRadius: 100,
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
  // Surcharge sheet
  addSurchargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
  },
  addSurchargeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#d97706',
  },
  surchargeAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  surchargeAmountLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  surchargeAmountInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'right',
    minWidth: 100,
  },
  surchargeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  surchargeInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  surchargeSubmitBtn: {
    backgroundColor: '#d97706',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  surchargeSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
