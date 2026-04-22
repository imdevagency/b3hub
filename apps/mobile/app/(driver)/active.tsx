import React, { useEffect, useCallback, useRef } from 'react';
import {
  TextInput,
  Text as RNText,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  AppState,
  AppStateStatus,
  LayoutAnimation,
  UIManager,
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
import { ActiveJobMap } from '@/components/driver/ActiveJobMap';
import { styles } from '@/lib/active-styles';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { BottomSheet } from '@/components/ui/BottomSheet';

import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/theme';
import {
  MapPin,
  Navigation,
  Map,
  ArrowLeft,
  Phone,
  Truck,
  CheckCircle2,
  AlertCircle,
  Camera,
  PlusCircle,
  FileText,
  Clock as ClockIcon,
  Star,
  MessageCircle,
  MoreHorizontal,
  ChevronRight,
  BarChart2,
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

const DOC_LABELS: Record<string, string> = {
  DELIVERY_PROOF: 'Piegādes apliecinājums',
  WEIGHING_SLIP: 'Svēršanas biļete',
};

const STEP_PROGRESS_LABELS: Record<JobStatus, string> = {
  ACCEPTED: 'Darbs pieņemts',
  EN_ROUTE_PICKUP: 'Brauciens uz iekraušanu',
  AT_PICKUP: 'Iekraušana objektā',
  LOADED: 'Krava apstiprināta',
  EN_ROUTE_DELIVERY: 'Brauciens uz piegādi',
  AT_DELIVERY: 'Izkraušana un nodošana',
  DELIVERED: 'Darbs pabeigts',
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatDocCode(code: string): string {
  return DOC_LABELS[code] ?? code.replaceAll('_', ' ').toLowerCase();
}

function getPhaseMeta(
  status: JobStatus,
  nextStatus: JobStatus | null,
  options: { isOffline: boolean; openExceptionCount: number; returnTripCount: number },
) {
  const { isOffline, openExceptionCount, returnTripCount } = options;

  if (status === 'DELIVERED') {
    return {
      eyebrow: 'Darbs pabeigts',
      title: 'Piegāde noslēgta',
      subtitle: 'Varat atrast nākamo darbu vai aizvērt šo maiņas posmu.',
      nextLabel: 'Gatavs nākamajam darbam',
    };
  }

  if (status === 'AT_PICKUP') {
    return {
      eyebrow: 'Iekraušanas brīdis',
      title: 'Apstipriniet kravu bez steigas',
      subtitle:
        'Ievadiet faktisko svaru un, ja vajag, pievienojiet foto, lai pāreja uz piegādi būtu vienā solī.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  if (status === 'AT_DELIVERY') {
    return {
      eyebrow: 'Nodošanas brīdis',
      title: 'Pabeidziet piegādi ar pierādījumu',
      subtitle:
        'Kad viss ir gatavs, ievadiet piegādes apliecinājumu un noslēdziet darbu bez papildu soļiem.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  if (status === 'LOADED' || status === 'EN_ROUTE_DELIVERY') {
    return {
      eyebrow: 'Piegādes fāze',
      title: 'Svarīgākais ir skaidrs un tuvumā',
      subtitle: isOffline
        ? 'Jūs esat bezsaistē. Darbības tiks saglabātas un nosūtītas, tiklīdz atgriezīsies savienojums.'
        : openExceptionCount > 0
          ? `Ir ${openExceptionCount} aktīva${openExceptionCount > 1 ? 's' : ''} problēma${openExceptionCount > 1 ? 's' : ''}.`
          : returnTripCount > 0
            ? `${returnTripCount} atpakaļceļa krava${returnTripCount > 1 ? 's' : ''} pieejama tuvumā.`
            : 'Navigācija, kontakts un problēmu ziņošana ir pieejama bez pārslēgšanās starp ekrāniem.',
      nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
    };
  }

  return {
    eyebrow: 'Ceļā uz iekraušanu',
    title: 'Vispirms nokļūstiet pareizajā vietā',
    subtitle: isOffline
      ? 'Jūs esat bezsaistē. Navigācija darbosies, bet statusa maiņa tiks saglabāta rindā.'
      : 'Piegādātāja kontakts, čats un navigācija ir redzami uzreiz, lai nav jāmeklē nākamais solis.',
    nextLabel: nextStatus ? `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}` : 'Gatavs pabeigt posmu',
  };
}

function getStatusSheetMeta(status: JobStatus, nextStatus: JobStatus) {
  if (status === 'EN_ROUTE_PICKUP') {
    return {
      title: 'Ieradies iekraušanas vietā?',
      subtitle: 'Apstipriniet tikai tad, kad patiešām esat objektā un varat sākt iekraušanu.',
      confirmLabel: 'Jā, esmu klāt',
    };
  }

  if (status === 'LOADED') {
    return {
      title: 'Doties uz piegādi?',
      subtitle: 'Krava jau ir apstiprināta. Nākamais solis pārslēgs darbu uz piegādes režīmu.',
      confirmLabel: 'Sākt piegādi',
    };
  }

  if (status === 'EN_ROUTE_DELIVERY') {
    return {
      title: 'Ieradies piegādes vietā?',
      subtitle: 'Apstipriniet tikai tad, kad esat objektā un varat sākt nodošanu vai izkraušanu.',
      confirmLabel: 'Jā, esmu piegādē',
    };
  }

  return {
    title: 'Atjaunināt darba statusu?',
    subtitle: `Tālāk: ${STEP_PROGRESS_LABELS[nextStatus]}. Statuss tiks atjaunināts uzreiz vai saglabāts rindā, ja esat bezsaistē.`,
    confirmLabel: 'Turpināt',
  };
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
  const [acceptingReturnId, setAcceptingReturnId] = React.useState<string | null>(null);
  const [deliveryBlockers, setDeliveryBlockers] = React.useState<string[]>([]);
  const [readinessLoading, setReadinessLoading] = React.useState(false);
  const [exceptions, setExceptions] = React.useState<ApiTransportJobException[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = React.useState(false);
  const [exceptionType, setExceptionType] = React.useState<TransportExceptionType>('OTHER');
  const [exceptionNotes, setExceptionNotes] = React.useState('');
  const [exceptionActualQty, setExceptionActualQty] = React.useState('');
  const [exceptionPhotoUri, setExceptionPhotoUri] = React.useState<string | null>(null);
  const [uploadingExceptionPhoto, setUploadingExceptionPhoto] = React.useState(false);
  const [reportingException, setReportingException] = React.useState(false);
  const [resolvingExceptionId, setResolvingExceptionId] = React.useState<string | null>(null);
  const [resolutionById, setResolutionById] = React.useState<Record<string, string>>({});

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
  const surchargeInputRef = useRef<TextInput>(null);

  // ── Delay report sheet ───────────────────────────────────────
  const [delaySheetVisible, setDelaySheetVisible] = React.useState(false);
  const [delayMinutes, setDelayMinutes] = React.useState('30');
  const [delayReason, setDelayReason] = React.useState('');
  const [delaySubmitting, setDelaySubmitting] = React.useState(false);
  const [statusConfirmVisible, setStatusConfirmVisible] = React.useState(false);
  const [statusSubmitting, setStatusSubmitting] = React.useState(false);

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
      toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt vērtējumu');
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
              toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt darbu');
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
        toast.error('Neizdevās iegūt attēla datus.');
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
        toast.error(err instanceof Error ? err.message : 'Neizdevās augšupielādēt foto');
      }
    }
  };

  const handleTakeExceptionPhoto = async () => {
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
        toast.error('Neizdevās iegūt attēla datus.');
        return;
      }
      setUploadingExceptionPhoto(true);
      try {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const { url } = await api.transportJobs.uploadPickupPhoto(
          job.id,
          `data:${mimeType};base64,${asset.base64}`,
          mimeType,
          token!,
        );
        setExceptionPhotoUri(url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neizdevās augšupielādēt foto');
      } finally {
        setUploadingExceptionPhoto(false);
      }
    }
  };

  // ── Fetch return trips when status enters EN_ROUTE_DELIVERY / AT_DELIVERY ──
  useEffect(() => {
    if (!token || !job) return;
    const status = job.status as JobStatus;
    if (!RETURN_TRIP_STATUSES.includes(status)) return;
    if (job.deliveryLat == null || job.deliveryLng == null) return;
    api.transportJobs
      .returnTrips(job.deliveryLat, job.deliveryLng, 75, token)
      .then((trips) => setReturnTrips(trips))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Neizdevās ielādēt atgriešanās darbus');
        setReturnTrips([]);
      });
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
      if (!exceptionPhotoUri) {
        Alert.alert(
          'Nepieciešams foto',
          'Lūdzu pievienojiet foto pierādījumu par daļēju piegādi (kravas foto / pavadzīme).',
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
          ...(exceptionPhotoUri ? { photoUrls: [exceptionPhotoUri] } : {}),
        },
        token,
      );
      setExceptions((prev) => [created, ...prev]);
      setExceptionNotes('');
      setExceptionActualQty('');
      setExceptionType('OTHER');
      setExceptionPhotoUri(null);
      haptics.success();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās iesniegt izņēmumu');
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
      toast.error(err instanceof Error ? err.message : 'Neizdevās atrisināt izņēmumu');
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
            toast.error(err instanceof Error ? err.message : 'Neizdevās pieņemt darbu');
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

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [job?.status, activeTab, returnTrips.length, exceptions.length]);

  // ── Polling fallback — refetch every 30 s in case WebSocket drops ──
  useEffect(() => {
    if (!job?.id || job.status === 'DELIVERED') return;
    const interval = setInterval(() => {
      fetchActiveJob();
    }, 30_000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status, fetchActiveJob]);

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
  const phaseMeta = getPhaseMeta(currentStatus, nextStatus, {
    isOffline,
    openExceptionCount: openExceptions.length,
    returnTripCount: returnTrips.length,
  });
  const statusSheetMeta = nextStatus ? getStatusSheetMeta(currentStatus, nextStatus) : null;

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
      ).catch(() => toast.error('Neizdevās atvērt navigāciju'));
      return;
    }

    const openUrl = (url: string, fallback: string) =>
      Linking.canOpenURL(url)
        .then((ok) => Linking.openURL(ok ? url : fallback))
        .catch(() => toast.error('Neizdevās atvērt navigāciju'));

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
      Linking.openURL(`tel:${phone}`).catch(() => toast.error('Neizdevās iniciēt zvanu'));
    } else {
      Alert.alert(
        t.activeJob.noContact,
        name ? `${name}: ${t.activeJob.noContactDesc}` : t.activeJob.noContactDesc,
      );
    }
  };

  const submitStatusUpdate = async (targetStatus: JobStatus) => {
    if (!token) return;
    setStatusSubmitting(true);
    try {
      const updated = await api.transportJobs.updateStatus(job.id, targetStatus, token);
      setJob(updated);
      setStatusConfirmVisible(false);
      haptics.success();
    } catch (err: unknown) {
      const netState = await NetInfo.fetch();
      const online = netState.isConnected === true && netState.isInternetReachable !== false;
      if (!online) {
        try {
          const raw = await AsyncStorage.getItem('b3hub_offline_queue');
          const queue = raw ? JSON.parse(raw) : [];
          queue.push({ jobId: job.id, nextStatus: targetStatus, timestamp: Date.now() });
          await AsyncStorage.setItem('b3hub_offline_queue', JSON.stringify(queue));
          setStatusConfirmVisible(false);
          haptics.warning();
          toast.info('Offline — statuss tiks atjaunināts, kad atjaunosies savienojums');
        } catch {
          toast.error('Neizdevās saglabāt statusu rindā — lūdzu mēģiniet vēlreiz');
        }
      } else {
        haptics.error();
        Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atjaunināt statusu');
      }
    } finally {
      setStatusSubmitting(false);
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
      router.push({
        pathname: '/delivery-proof',
        params: { jobId: job.id, sitePhotoUrl: job.order?.sitePhotoUrl ?? '' },
      });
      return;
    }

    // AT_PICKUP → LOADED requires weight ticket reading
    if (currentStatus === 'AT_PICKUP') {
      setWeightInput('');
      setPickupPhotoUri(null);
      setWeightModalVisible(true);
      return;
    }

    setStatusConfirmVisible(true);
  };

  const handleWeightConfirm = async () => {
    if (!token || !job) return;
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (!kg || kg <= 0 || isNaN(kg)) {
      toast.error('Ievadiet derīgu svaru kilogramos.');
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
      toast.error(err instanceof Error ? err.message : 'Neizdevās atjaunināt statusu');
    } finally {
      setWeightSubmitting(false);
    }
  };

  const handleAddSurcharge = async () => {
    if (!job || !token) return;
    const amount = parseFloat(surchargeAmount.replace(',', '.'));
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast.error('Ievadiet derīgu summu eiro.');
      return;
    }
    setSurchargeSubmitting(true);
    try {
      const result = await api.transportJobs.addSurcharge(
        job.id,
        { type: surchargeType, amount },
        token,
      );
      const isPending = result?.approvalStatus === 'PENDING';
      if (isPending) {
        toast.info('Piemaksa nosūtīta apstiprināšanai');
      } else {
        toast.success('Papildu maksa pievienota');
      }
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
      toast.error('Ievadiet kavēšanās laiku (1–480 minūtes).');
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
      toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt paziņojumu');
    } finally {
      setDelaySubmitting(false);
    }
  };

  return (
    <ScreenContainer bg="transparent" topInset={0} style={{ flex: 1 }} noAnimation>
      <OfflineBanner />
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
            top: 8,
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
            backgroundColor: '#ffffff',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 18,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 4,
            borderWidth: 1,
            borderColor: phaseColor.border,
            minWidth: 172,
          }}
        >
          <RNText
            style={{
              fontSize: 11,
              fontFamily: 'Inter_700Bold',
              fontWeight: '700',
              color: phaseColor.text,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {phaseMeta.eyebrow}
          </RNText>
          <RNText
            style={{
              fontSize: 15,
              fontFamily: 'Inter_700Bold',
              fontWeight: '700',
              color: colors.textPrimary,
              marginTop: 2,
            }}
          >
            {phaseColor.phase}
          </RNText>
          <RNText
            style={{
              fontSize: 12,
              fontFamily: 'Inter_500Medium',
              fontWeight: '500',
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            {phaseMeta.nextLabel}
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
                backgroundColor: colors.primary,
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

        <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <View
              style={{
                backgroundColor: phaseColor.bg,
                borderColor: phaseColor.border,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
              }}
            >
              <RNText
                style={{
                  fontSize: 12,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: phaseColor.text,
                }}
              >
                {phaseColor.phase}
              </RNText>
            </View>
            <RNText
              style={{
                fontSize: 12,
                fontFamily: 'Inter_600SemiBold',
                fontWeight: '600',
                color: colors.textMuted,
              }}
            >
              {currentIndex + 1}/{STATUS_STEPS.length}
            </RNText>
          </View>

          <RNText
            style={{
              fontSize: 22,
              lineHeight: 28,
              fontFamily: 'Inter_700Bold',
              fontWeight: '700',
              color: colors.textPrimary,
              letterSpacing: -0.4,
            }}
          >
            {phaseMeta.title}
          </RNText>
          <RNText
            style={{
              fontSize: 14,
              lineHeight: 20,
              fontFamily: 'Inter_500Medium',
              fontWeight: '500',
              color: colors.textMuted,
              marginTop: 6,
            }}
          >
            {phaseMeta.subtitle}
          </RNText>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            {STATUS_STEPS.map((step, index) => {
              const isComplete = index <= currentIndex;
              const isCurrent = index === currentIndex;

              return (
                <React.Fragment key={step}>
                  <View
                    style={{
                      width: isCurrent ? 12 : 10,
                      height: isCurrent ? 12 : 10,
                      borderRadius: 999,
                      backgroundColor: isComplete ? colors.primary : '#d1d5db',
                      borderWidth: isCurrent ? 3 : 0,
                      borderColor: isCurrent ? '#d9f99d' : 'transparent',
                    }}
                  />
                  {index < STATUS_STEPS.length - 1 ? (
                    <View
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 999,
                        marginHorizontal: 4,
                        backgroundColor: index < currentIndex ? colors.primary : '#e5e7eb',
                      }}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>

          <RNText
            style={{
              fontSize: 12,
              fontFamily: 'Inter_600SemiBold',
              fontWeight: '600',
              color: colors.textSecondary,
              marginTop: 8,
            }}
          >
            {STEP_PROGRESS_LABELS[currentStatus]}
          </RNText>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {isOffline ? (
              <View
                style={{
                  backgroundColor: '#fef3c7',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <RNText
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#b45309',
                  }}
                >
                  Bezsaistē: darbības tiks rindotas
                </RNText>
              </View>
            ) : null}
            {openExceptions.length > 0 ? (
              <View
                style={{
                  backgroundColor: '#fef2f2',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <RNText
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#b91c1c',
                  }}
                >
                  {openExceptions.length} atvērta{openExceptions.length > 1 ? 's' : ''} problēma
                </RNText>
              </View>
            ) : null}
            {returnTrips.length > 0 && RETURN_TRIP_STATUSES.includes(currentStatus) ? (
              <View
                style={{
                  backgroundColor: '#ecfdf5',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <RNText
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#047857',
                  }}
                >
                  {returnTrips.length} atpakaļceļa iespēja
                </RNText>
              </View>
            ) : null}
          </View>
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
              color: colors.textPrimary,
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
              color: colors.textMuted,
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
                      backgroundColor: colors.bgMuted,
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
                  onPress={() => {
                    const atPickupStage =
                      currentStatus === 'ACCEPTED' ||
                      currentStatus === 'EN_ROUTE_PICKUP' ||
                      currentStatus === 'AT_PICKUP';
                    if (atPickupStage) {
                      handleCall(
                        job.order?.supplierPhone,
                        job.order?.supplierName ?? 'Piegādātājs',
                      );
                    } else {
                      handleCall(job.order?.siteContactPhone, job.order?.siteContactName);
                    }
                  }}
                  style={{ alignItems: 'center', justifyContent: 'center', gap: 6, width: 64 }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: colors.bgMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={24} color="#111827" />
                  </View>
                  <RNText style={{ fontSize: 12, color: '#4b5563', fontWeight: '600' }}>
                    {currentStatus === 'ACCEPTED' ||
                    currentStatus === 'EN_ROUTE_PICKUP' ||
                    currentStatus === 'AT_PICKUP'
                      ? 'Piegādātājs'
                      : 'Zvanīt'}
                  </RNText>
                </TouchableOpacity>

                {job?.id && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[jobId]',
                        params: {
                          jobId: job.id,
                          title:
                            job.order?.siteContactName ?? job.order?.orderNumber ?? job.jobNumber,
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
                        backgroundColor: colors.bgMuted,
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
                      backgroundColor: colors.bgMuted,
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
                    backgroundColor: colors.primary,
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

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 2,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setActiveTab('issues')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#f9fafb',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                  }}
                >
                  <AlertCircle
                    size={15}
                    color={openExceptions.length > 0 ? '#b91c1c' : '#4b5563'}
                  />
                  <RNText
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                      color: openExceptions.length > 0 ? '#991b1b' : colors.textSecondary,
                    }}
                  >
                    {openExceptions.length > 0
                      ? `Problēmas (${openExceptions.length})`
                      : 'Ziņot problēmu'}
                  </RNText>
                </TouchableOpacity>

                {currentStatus !== 'DELIVERED' ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setDelaySheetVisible(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: '#f9fafb',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                    }}
                  >
                    <ClockIcon size={15} color="#4b5563" />
                    <RNText
                      style={{
                        fontSize: 13,
                        fontFamily: 'Inter_600SemiBold',
                        fontWeight: '600',
                        color: colors.textSecondary,
                      }}
                    >
                      Ziņot kavēšanos
                    </RNText>
                  </TouchableOpacity>
                ) : null}
              </View>
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
              <TouchableOpacity
                style={styles.viewStatsBtn}
                onPress={() => router.push(`/(driver)/job-stat/${job.id}`)}
                activeOpacity={0.8}
              >
                <BarChart2 size={15} color="#6b7280" />
                <Text style={styles.viewStatsBtnText}>Brašana statistika</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <BottomSheet
        visible={statusConfirmVisible}
        onClose={() => {
          if (!statusSubmitting) setStatusConfirmVisible(false);
        }}
        title={statusSheetMeta?.title}
        subtitle={statusSheetMeta?.subtitle}
      >
        <View style={{ gap: 14, paddingBottom: 12 }}>
          <View
            style={{
              backgroundColor: phaseColor.bg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: phaseColor.border,
              padding: 14,
            }}
          >
            <RNText
              style={{
                fontSize: 12,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: phaseColor.text,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Nākamais solis
            </RNText>
            <RNText
              style={{
                fontSize: 18,
                lineHeight: 24,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: colors.textPrimary,
                marginTop: 4,
              }}
            >
              {nextStatus ? STEP_PROGRESS_LABELS[nextStatus] : ''}
            </RNText>
            <RNText
              style={{
                fontSize: 14,
                lineHeight: 20,
                fontFamily: 'Inter_500Medium',
                fontWeight: '500',
                color: colors.textMuted,
                marginTop: 6,
              }}
            >
              {isOffline
                ? 'Ja savienojums nav pieejams, izmaiņa tiks saglabāta rindā un nosūtīta vēlāk.'
                : 'Statuss tiks atjaunināts uzreiz, un ekrāns paliks tajā pašā plūsmā.'}
            </RNText>
          </View>

          <Button
            size="lg"
            onPress={() => {
              if (nextStatus) {
                void submitStatusUpdate(nextStatus);
              }
            }}
            isLoading={statusSubmitting}
            disabled={statusSubmitting || !nextStatus}
          >
            {statusSheetMeta?.confirmLabel ?? 'Turpināt'}
          </Button>

          <Button
            size="lg"
            variant="outline"
            onPress={() => setStatusConfirmVisible(false)}
            disabled={statusSubmitting}
          >
            Atcelt
          </Button>
        </View>
      </BottomSheet>

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
                  color: colors.textMuted,
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
                  color: colors.textPrimary,
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
                <Text
                  style={{ fontSize: 13, color: colors.success, fontWeight: '700', marginTop: 2 }}
                >
                  €{job.pricePerTonne.toFixed(2)}/t
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
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
                  color: colors.textPrimary,
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
                    color: colors.textPrimary,
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

          {/* Site photo */}
          {job.order?.sitePhotoUrl ? (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: '#374151',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Izkraušanas vieta
              </Text>
              <Image
                source={{ uri: job.order.sitePhotoUrl }}
                style={{ width: '100%', height: 180, borderRadius: 16 }}
                resizeMode="cover"
              />
            </View>
          ) : null}

          {/* Timeline-style Addresses */}
          <View
            style={{
              backgroundColor: colors.bgSubtle,
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
                    backgroundColor: colors.primary,
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
                    color: colors.textMuted,
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
                    color: colors.textPrimary,
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
                    backgroundColor: colors.primary,
                    zIndex: 2,
                    marginTop: 6,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
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
                    color: colors.textPrimary,
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
                    color: colors.textDisabled,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Attālums
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: colors.textPrimary,
                    marginTop: 4,
                  }}
                >
                  {job.distanceKm.toFixed(1)} km
                </Text>
              </View>
            )}
            {job.requiredVehicleType && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textDisabled,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Auto tips
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: colors.textPrimary,
                    marginTop: 4,
                  }}
                >
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
              color: colors.textDisabled,
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
              borderColor: colors.border,
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
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
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
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
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
                backgroundColor: colors.bgMuted,
                padding: 16,
                borderRadius: 16,
              }}
            >
              <RNText
                style={{
                  fontSize: 13,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: colors.textPrimary,
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
                        color: colors.textPrimary,
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
                          color: colors.textMuted,
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
              color: colors.textPrimary,
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
                  color: colors.textPrimary,
                  marginBottom: 12,
                }}
              >
                Faktiskais daudzums (t)
              </RNText>
              <TextInput
                style={{
                  backgroundColor: colors.bgMuted,
                  borderRadius: 16,
                  padding: 16,
                  fontSize: 18,
                  fontFamily: 'Inter_600SemiBold',
                  color: colors.textPrimary,
                }}
                keyboardType="decimal-pad"
                placeholder={job.cargoWeight ? `Plānotais: ${job.cargoWeight} t` : '0 t'}
                placeholderTextColor="#9ca3af"
                value={exceptionActualQty}
                onChangeText={setExceptionActualQty}
              />

              <RNText
                style={{
                  fontSize: 15,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: colors.textPrimary,
                  marginTop: 20,
                  marginBottom: 12,
                }}
              >
                Pievienot foto pierādījumu
              </RNText>
              <TouchableOpacity
                style={[styles.photoCapture, exceptionPhotoUri ? styles.photoCaptured : null]}
                onPress={handleTakeExceptionPhoto}
                activeOpacity={0.8}
                disabled={uploadingExceptionPhoto}
              >
                {exceptionPhotoUri ? (
                  <View style={styles.photoPreview}>
                    <Image
                      source={{ uri: exceptionPhotoUri }}
                      style={styles.photoThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.photoCheck}>
                      <CheckCircle2 size={14} color="#111827" />
                      <Text style={styles.photoCheckText}>Foto pievienots</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPicker}>
                    {uploadingExceptionPhoto ? (
                      <ActivityIndicator size="small" color="#111827" />
                    ) : (
                      <Camera size={22} color="#6b7280" />
                    )}
                    <Text style={styles.photoPickerText}>
                      {uploadingExceptionPhoto ? 'Augšupielādē...' : 'Fotografēt pavadzīmi'}
                    </Text>
                    <Text style={styles.photoPickerHint}>Obligāts daļējai piegādei</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Notes ── */}
          <View style={{ marginBottom: 32 }}>
            <RNText
              style={{
                fontSize: 15,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Papildu informācija
            </RNText>
            <TextInput
              style={{
                backgroundColor: colors.bgMuted,
                borderRadius: 16,
                padding: 16,
                fontSize: 16,
                fontFamily: 'Inter_500Medium',
                minHeight: 120,
                color: colors.textPrimary,
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
                color: colors.textMuted,
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
                color: colors.textPrimary,
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
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Kavēšanās laiks (minūtes)
            </RNText>
            <TextInput
              style={{
                backgroundColor: colors.bgMuted,
                borderRadius: 16,
                padding: 16,
                fontSize: 18,
                fontFamily: 'Inter_600SemiBold',
                color: colors.textPrimary,
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
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Kāpēc kavējaties? (Neobligāti)
            </RNText>
            <TextInput
              style={{
                backgroundColor: colors.bgMuted,
                borderRadius: 16,
                padding: 16,
                fontSize: 16,
                fontFamily: 'Inter_500Medium',
                minHeight: 120,
                color: colors.textPrimary,
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
                backgroundColor: colors.bgSubtle,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
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
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                    €{rt.rate.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
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
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
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
              <Text style={{ fontSize: 14, color: colors.textDisabled }}>Izlaist</Text>
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
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: 6,
              }}
            >
              Iemesls *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.textPrimary,
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
            <Text
              style={{ fontSize: 11, color: colors.textDisabled, textAlign: 'right', marginTop: 4 }}
            >
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
