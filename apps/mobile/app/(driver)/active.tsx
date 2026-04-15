import React, { useEffect, useCallback, useRef } from 'react';
import {
  TextInput,
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
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { haptics } from '@/lib/haptics';
import { estimateCo2Kg, formatCo2 } from '@/lib/co2';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';

import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/text';
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

  // ── Extra sheet visibility ────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<'navigate' | 'details' | 'issues'>('navigate');
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

  // ── Delay report sheet ───────────────────────────────────────
  const [delaySheetVisible, setDelaySheetVisible] = React.useState(false);
  const [delayMinutes, setDelayMinutes] = React.useState('30');
  const [delayReason, setDelayReason] = React.useState('');
  const [delaySubmitting, setDelaySubmitting] = React.useState(false);

  // ── Offline queue ────────────────────────────────────────────────
  const [isOffline, setIsOffline] = React.useState(false);

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
      // silently ignore storage errors
    }
  }, [token, job?.id]);

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
                // silently ignore storage errors
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
            followCurrentPosition
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

      {/* ── Top Bar Overlay (HUD) ── */}
      <View
        style={[styles.topOverlay, { top: Math.max(insets.top + 8, 16) }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>

        {job.sla?.isOverdue && (
          <View style={styles.slaBadge}>
            <Clock size={16} color="#dc2626" />
            <Text style={styles.slaText}>{job.sla.overdueMinutes} min kavējas</Text>
          </View>
        )}
      </View>

      {/* ── Floating Nav & Call HUD ── */}
      <View style={styles.hudContainer} pointerEvents="box-none">
        <View style={styles.hudButtonGroup}>
          <TouchableOpacity style={styles.hudButton} onPress={handleNavigate} activeOpacity={0.8}>
            <Navigation size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hudButton, { backgroundColor: '#fff' }]}
            onPress={() => handleCall(job.order?.siteContactPhone, job.order?.siteContactName)}
            activeOpacity={0.8}
          >
            <Phone size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Static Bottom Card ── */}
      <View style={[styles.staticBottomCard, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.detailsPull}>
          <View style={styles.detailsPullHandle} />
        </View>
        {/* ── Inline Tab Bar ── */}
        <View style={inlineTabStyles.bar}>
          <InlineTab
            label="Navigācija"
            active={activeTab === 'navigate'}
            onPress={() => setActiveTab('navigate')}
          />
          <InlineTab
            label="Detaļas"
            active={activeTab === 'details'}
            onPress={() => setActiveTab('details')}
          />
          <InlineTab
            label="Problēmas"
            active={activeTab === 'issues'}
            badge={
              openExceptions.length > 0 && activeTab !== 'issues'
                ? openExceptions.length
                : undefined
            }
            onPress={() => setActiveTab('issues')}
          />
        </View>
        <View style={activeTab !== 'navigate' ? { display: 'none' } : undefined}>
          {/* Return trips proactive chip */}
          {returnTrips.length > 0 && (
            <TouchableOpacity
              style={styles.returnTripsChip}
              onPress={() => setReturnTripsSheetVisible(true)}
              activeOpacity={0.8}
            >
              <Truck size={14} color="#059669" />
              <Text style={styles.returnTripsChipText}>
                {returnTrips.length} atpakaļceļa {returnTrips.length === 1 ? 'kravu' : 'kravas'}{' '}
                tuvumā
              </Text>
              <Text style={{ fontSize: 16, color: '#059669', fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          )}

          {/* Minimal Uber-like Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: phaseColor.text || '#000',
                }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: phaseColor.text || '#000',
                }}
              >
                {currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP'
                  ? 'Dodies uz iekraušanu'
                  : currentStatus === 'AT_PICKUP'
                    ? 'Iekraušana'
                    : currentStatus === 'LOADED' || currentStatus === 'EN_ROUTE_DELIVERY'
                      ? 'Dodies uz izkraušanu'
                      : currentStatus === 'AT_DELIVERY'
                        ? 'Piegāde'
                        : 'Pabeigts'}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#9ca3af' }}>
              #{job.jobNumber}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: '#111827',
              marginBottom: 14,
              letterSpacing: -0.5,
              lineHeight: 30,
            }}
            adjustsFontSizeToFit
            numberOfLines={2}
          >
            {currentStatus === 'ACCEPTED' ||
            currentStatus === 'EN_ROUTE_PICKUP' ||
            currentStatus === 'AT_PICKUP'
              ? `${job.pickupAddress}, ${job.pickupCity}`
              : `${job.deliveryAddress}, ${job.deliveryCity}`}
          </Text>

          {/* Progress stepper */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.5)',
                fontWeight: '600',
              }}
            >
              Solis {currentIndex + 1}/{STATUS_STEPS.length}
            </Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
              {t.activeJob.status[currentStatus] ?? currentStatus}
            </Text>
          </View>
          <View style={styles.stepperRow}>
            {STATUS_STEPS.map((step, i) => (
              <View
                key={step}
                style={[
                  styles.stepDot,
                  i < currentIndex ? styles.stepDotDone : null,
                  i === currentIndex ? styles.stepDotActive : null,
                ]}
              />
            ))}
          </View>

          {/* Offline banner */}
          {isOffline && (
            <View style={styles.offlineBanner}>
              <AlertCircle size={14} color="#92400e" />
              <Text style={styles.offlineBannerText}>
                Offline — izmaiņas tiks saglabātas un sūtītas, kad atjaunosies savienojums
              </Text>
            </View>
          )}

          {/* Primary Action Button */}
          <View style={styles.actionRow}>
            {nextStatus ? (
              <TouchableOpacity style={[styles.primaryButton]} onPress={handleUpdateStatus}>
                <Text style={styles.primaryButtonText} className="font-bold">
                  {currentStatus === 'AT_DELIVERY'
                    ? t.deliveryProof.title
                    : currentStatus === 'AT_PICKUP'
                      ? 'Apstiprināt kravu'
                      : currentStatus === 'LOADED'
                        ? 'Dodos uz piegādi →'
                        : currentStatus === 'EN_ROUTE_PICKUP'
                          ? 'Esmu iekraušanas vietā →'
                          : currentStatus === 'EN_ROUTE_DELIVERY'
                            ? 'Esmu piegādes vietā →'
                            : t.activeJob.status[nextStatus]}
                </Text>
                {currentStatus !== 'AT_DELIVERY' && (
                  <Text className="font-bold" style={{ color: '#ffffff80', fontSize: 18 }}>
                    →
                  </Text>
                )}
              </TouchableOpacity>
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
              </View>
            )}
          </View>
        </View>{' '}
        {/* end navigate wrapper */}
        {/* ── Details Tab (inline) ── */}
        {activeTab === 'details' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 268 }}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
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
              <Text style={styles.detailValue}>€{job.rate?.toFixed(2) ?? '-'}</Text>
            </View>
            {(() => {
              const co2 = estimateCo2Kg(job.distanceKm, job.cargoWeight);
              if (!co2) return null;
              return (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CO₂ ietekme</Text>
                  <Text style={[styles.detailValue, { color: '#16a34a' }]}>~{formatCo2(co2)}</Text>
                </View>
              );
            })()}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Iekraušana</Text>
              <Text style={styles.detailValue}>
                {job.pickupAddress}, {job.pickupCity}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Izkraušana</Text>
              <Text style={styles.detailValue}>
                {job.deliveryAddress}, {job.deliveryCity}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.reportProblemBtn}
              onPress={() => setActiveTab('issues')}
              activeOpacity={0.8}
            >
              <AlertCircle size={16} color="#dc2626" />
              <Text style={styles.reportProblemText}>Ziņot par problēmu</Text>
            </TouchableOpacity>
            {job.status !== 'DELIVERED' && job.status !== 'CANCELLED' && (
              <TouchableOpacity
                style={[styles.reportProblemBtn, { borderColor: '#d97706', marginTop: 0 }]}
                onPress={() => setDelaySheetVisible(true)}
                activeOpacity={0.8}
              >
                <Clock size={16} color="#d97706" />
                <Text style={[styles.reportProblemText, { color: '#d97706' }]}>
                  Ziņot par kavēšanos
                </Text>
              </TouchableOpacity>
            )}
            {job.status !== 'DELIVERED' && job.status !== 'CANCELLED' && (
              <TouchableOpacity
                style={styles.addSurchargeBtn}
                onPress={() => setSurchargeSheetVisible(true)}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#d97706" />
                <Text style={styles.addSurchargeBtnText}>Pievienot papildu maksu</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        {/* ── Issues Tab (inline) ── */}
        {activeTab === 'issues' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 268 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {EXCEPTION_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setExceptionType(opt.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: exceptionType === opt.value ? '#991b1b' : '#f9fafb',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: exceptionType === opt.value ? '#fff' : '#374151',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: 12,
                padding: 14,
                height: 80,
                fontSize: 15,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                color: '#111827',
                textAlignVertical: 'top',
              }}
              placeholder="Aprakstiet situāciju..."
              placeholderTextColor="#9ca3af"
              value={exceptionNotes}
              onChangeText={setExceptionNotes}
              multiline
            />
            {exceptionType === 'PARTIAL_DELIVERY' && (
              <View>
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}
                >
                  Faktiskā piegādātā daudzums
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    color: '#111827',
                  }}
                  placeholder="piem. 4.5"
                  placeholderTextColor="#9ca3af"
                  value={exceptionActualQty}
                  onChangeText={setExceptionActualQty}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
            {exceptions.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6b7280' }}>Vēsture</Text>
                {exceptions.map((ex) => (
                  <View
                    key={ex.id}
                    style={{
                      backgroundColor: ex.status === 'OPEN' ? '#fef2f2' : '#f0fdf4',
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: ex.status === 'OPEN' ? '#fecaca' : '#bbf7d0',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: ex.status === 'OPEN' ? '#991b1b' : '#15803d',
                      }}
                    >
                      {EXCEPTION_TYPE_OPTIONS.find((o) => o.value === ex.type)?.label ?? ex.type}
                      {' · '}
                      {ex.status === 'OPEN' ? 'Atvērts' : 'Atrisināts'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{ex.notes}</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.weightConfirm, reportingException && { opacity: 0.6 }]}
              onPress={handleReportException}
              disabled={reportingException}
            >
              <Text style={styles.weightConfirmText}>
                {reportingException ? 'Sūta...' : 'Ziņot dispečeram'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* ── Surcharge Sheet ── */}
      <BottomSheet
        visible={surchargeSheetVisible}
        onClose={() => setSurchargeSheetVisible(false)}
        title="Papildu maksa"
        subtitle="Pievienojiet gaidīšanas laiku, degvielas piemaksu u.c."
        scrollable
        maxHeightPct={0.65}
      >
        <View style={{ gap: 14, paddingBottom: 32 }}>
          {/* Surcharge type picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {SURCHARGE_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSurchargeType(opt.value)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: surchargeType === opt.value ? '#d97706' : '#f3f4f6',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: surchargeType === opt.value ? '#fff' : '#374151',
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Amount input */}
          <View style={styles.surchargeAmountRow}>
            <Text style={styles.surchargeAmountLabel}>Summa (€)</Text>
            <TextInput
              style={styles.surchargeAmountInput}
              value={surchargeAmount}
              onChangeText={setSurchargeAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.surchargeSubmitBtn, surchargeSubmitting && { opacity: 0.6 }]}
            onPress={handleAddSurcharge}
            disabled={surchargeSubmitting || !surchargeAmount}
            activeOpacity={0.8}
          >
            <Text style={styles.surchargeSubmitText}>
              {surchargeSubmitting ? 'Saglabā...' : 'Pievienot papildu maksu'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Delay Report Sheet ── */}
      <BottomSheet
        visible={delaySheetVisible}
        onClose={() => setDelaySheetVisible(false)}
        title="Ziņot par kavēšanos"
        subtitle="Pasūtītājs saņems paziņojumu"
      >
        <View style={{ gap: 14, paddingBottom: 32 }}>
          <View>
            <Text style={styles.surchargeLabel}>Kavēšanās laiks (minūtes)</Text>
            <TextInput
              style={styles.surchargeInput}
              keyboardType="numeric"
              value={delayMinutes}
              onChangeText={setDelayMinutes}
              placeholder="30"
              returnKeyType="done"
            />
          </View>
          <View>
            <Text style={styles.surchargeLabel}>Iemesls (neobligāti)</Text>
            <TextInput
              style={[styles.surchargeInput, { height: 72, textAlignVertical: 'top' }]}
              value={delayReason}
              onChangeText={setDelayReason}
              placeholder="Satiksme, tehniskas problēmas..."
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.surchargeSubmitBtn, { backgroundColor: '#d97706' }]}
            onPress={handleReportDelay}
            disabled={delaySubmitting}
            activeOpacity={0.8}
          >
            <Text style={styles.surchargeSubmitText}>
              {delaySubmitting ? 'Sūta...' : 'Nosūtīt paziņojumu'}
            </Text>
          </TouchableOpacity>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
    width: 52,
    height: 52,
    borderRadius: 26,
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
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
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
