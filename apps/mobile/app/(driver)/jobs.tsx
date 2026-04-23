import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { estimateCo2Kg, formatCo2 } from '@/lib/co2';
import { SkeletonJobRow } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { FilterSheet } from '@/components/driver/FilterSheet';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { useToast } from '@/components/ui/Toast';
import {
  type TransportJob,
  type SearchFilter,
  type SavedSearch,
  ASYNC_KEY,
  filterJobs,
  mapJob,
  nearbyJobs,
} from '@/components/driver/job-types';
import { geocodeLocation, optimizeRoute } from '@/lib/maps';
import {
  Settings2,
  Search,
  Truck,
  CheckCircle2,
  ChevronRight,
  Ruler,
  Route,
  Map,
  List,
} from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '@/lib/theme';
// Lazy-load: react-native-gesture-handler native module not available in Expo Go
type SwipeableProps = {
  children?: React.ReactNode;
  renderRightActions?: () => React.ReactNode;
  friction?: number;
  rightThreshold?: number;
  overshootRight?: boolean;
  ref?: React.Ref<{ close(): void }>;
};
let Swipeable: React.ComponentType<SwipeableProps> = ({ children }: SwipeableProps) => (
  <View>{children}</View>
);
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Swipeable = require('react-native-gesture-handler').Swipeable;
} catch {
  /* Expo Go fallback — renders children without swipe gesture */
}
// ── (Types, constants and utilities moved to @/components/driver/job-types) ──

// ── Accept Bottom Sheet ───────────────────────────────────────────────────────
function AcceptBottomSheet({
  visible,
  job,
  nearby,
  onConfirm,
  loading = false,
  onClose,
  onDecline,
}: {
  visible: boolean;
  job: TransportJob | null;
  nearby: { job: TransportJob; gapKm: number }[];
  onConfirm: () => void;
  loading?: boolean;
  onClose: () => void;
  onDecline?: () => void;
}) {
  // Preserve last job so exit animation shows content
  const lastJobRef = useRef<TransportJob | null>(job);
  if (job) lastJobRef.current = job;
  const j = job ?? lastJobRef.current;
  if (!j) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.jobs.acceptSheetTitle} scrollable>
      <View style={{ gap: 14, paddingBottom: 8 }}>
        {/* Job summary */}
        <View style={styles.sheetJobCard}>
          <View style={styles.sheetJobHeader}>
            <Text style={styles.sheetJobNum}>{j.jobNumber}</Text>
            <Text style={styles.sheetJobPrice}>€{j.priceTotal.toFixed(0)}</Text>
          </View>
          <View style={styles.sheetRouteRow}>
            <View style={[styles.sheetRouteDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.sheetRouteCity}>{j.fromCity}</Text>
            <ChevronRight size={14} color="#9ca3af" />
            <View style={[styles.sheetRouteDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.sheetRouteCity}>{j.toCity}</Text>
          </View>
          <View style={styles.sheetJobMeta}>
            <Truck size={12} color="#9ca3af" />
            <Text style={styles.sheetMetaText}>{j.vehicleType}</Text>
            <Text style={styles.sheetMetaDot}>·</Text>
            <Ruler size={12} color="#9ca3af" />
            <Text style={styles.sheetMetaText}>{j.distanceKm} km</Text>
            <Text style={styles.sheetMetaDot}>·</Text>
            <Text style={styles.sheetMetaText}>{j.weightTonnes} t</Text>
          </View>
        </View>

        {/* Route preview map */}
        {j.fromLat !== 0 && j.fromLng !== 0 && j.toLat !== 0 && j.toLng !== 0 && (
          <JobRouteMap
            pickup={{ lat: j.fromLat, lng: j.fromLng, label: j.fromCity }}
            delivery={{ lat: j.toLat, lng: j.toLng, label: j.toCity }}
            height={160}
            borderRadius={12}
            showToPickupLeg={false}
          />
        )}

        {/* Return suggestions */}
        {nearby.length > 0 && (
          <View style={styles.sheetReturnSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Route size={14} color="#059669" />
              <Text style={styles.sheetReturnTitle}>{t.jobs.acceptSheetReturnTitle}</Text>
            </View>
            {nearby.map(({ job: nj, gapKm }) => (
              <View key={nj.id} style={styles.sheetReturnCard}>
                <View style={styles.sheetReturnLeft}>
                  <View style={styles.sheetReturnKmBadge}>
                    <Text style={styles.sheetReturnKmText}>{t.jobs.acceptSheetGapKm(gapKm)}</Text>
                  </View>
                  <View style={styles.sheetRouteRow}>
                    <Text style={styles.sheetReturnCity}>{nj.fromCity}</Text>
                    <ChevronRight size={11} color="#9ca3af" />
                    <Text style={styles.sheetReturnCity}>{nj.toCity}</Text>
                  </View>
                </View>
                <Text style={styles.sheetReturnPrice}>€{nj.priceTotal.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}

        {nearby.length === 0 && (
          <Text style={styles.sheetReturnNone}>{t.jobs.acceptSheetReturnNone}</Text>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.sheetAcceptBtn, loading && { opacity: 0.6 }]}
          onPress={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sheetAcceptBtnText}>{t.jobs.acceptAndGo}</Text>
          )}
        </TouchableOpacity>
        {onDecline && (
          <TouchableOpacity style={styles.sheetDeclineBtn} onPress={onDecline} disabled={loading}>
            <Text style={styles.sheetDeclineBtnText}>Atteikt darbu</Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
}

// ── Active filter pill ────────────────────────────────────────────────────────
function ActiveFilterPill({ filter, onClear }: { filter: SearchFilter; onClear: () => void }) {
  const parts: string[] = [];
  if (filter.fromLocation)
    parts.push(filter.fromLocation + (filter.fromRadius ? ` +${filter.fromRadius}km` : ''));
  if (filter.toLocation)
    parts.push('→ ' + filter.toLocation + (filter.toRadius ? ` +${filter.toRadius}km` : ''));
  return (
    <View style={styles.activePill}>
      <Text style={styles.activePillLabel}>{t.jobSearch.activeFilter}:</Text>
      <Text style={styles.activePillText} numberOfLines={1}>
        {parts.join('  ')}
      </Text>
      <TouchableOpacity onPress={onClear} style={styles.activePillClear}>
        <Text style={styles.activePillClearText}>{t.jobSearch.clearFilter}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Save-search modal ─────────────────────────────────────────────────────────
function SaveSearchModal({
  visible,
  filter,
  onSave,
  onClose,
}: {
  visible: boolean;
  filter: SearchFilter;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (visible) {
      const parts: string[] = [];
      if (filter.fromLocation) parts.push(filter.fromLocation);
      if (filter.toLocation) parts.push('→ ' + filter.toLocation);
      setName(parts.join(' '));
    }
  }, [visible]);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.jobSearch.savedSearchTitle}
      scrollable
    >
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <TextInput
          style={styles.modalInput}
          value={name}
          onChangeText={setName}
          placeholder={t.jobSearch.savedSearchNamePlaceholder}
          placeholderTextColor="#9ca3af"
          autoFocus
        />
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
            <Text style={styles.modalCancelText}>{t.jobSearch.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSave, !name.trim() && styles.modalSaveDisabled]}
            onPress={() => {
              if (name.trim()) onSave(name.trim());
            }}
          >
            <Text style={styles.modalSaveText}>{t.jobSearch.save}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────
const JobCard = React.memo(function JobCard({
  job,
  onAccept,
  tourMode = false,
  selected = false,
  onToggleSelect,
}: {
  job: TransportJob;
  onAccept: (id: string) => void;
  tourMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const swipeRef = useRef<{ close(): void } | null>(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={mapStyles.swipeAccept}
      onPress={() => {
        swipeRef.current?.close();
        onAccept(job.id);
      }}
      activeOpacity={0.85}
    >
      <CheckCircle2 size={22} color="#fff" />
      <Text style={mapStyles.swipeAcceptText}>Pieņemt</Text>
    </TouchableOpacity>
  );

  const card = (
    <TouchableOpacity
      style={[styles.card, tourMode && selected && styles.cardSelected]}
      activeOpacity={0.85}
      onPress={tourMode ? () => onToggleSelect?.(job.id) : () => onAccept(job.id)}
    >
      {/* Tour selection indicator */}
      {tourMode && (
        <View style={styles.tourCheckWrap}>
          {selected ? (
            <CheckCircle2 size={24} color="#111827" fill="#fff" />
          ) : (
            <View style={styles.tourCheckEmpty} />
          )}
        </View>
      )}

      {/* ── Top Row: Price & Essential Meta ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: '800',
            color: colors.textPrimary,
            lineHeight: 36,
            letterSpacing: -0.5,
          }}
        >
          €{job.priceTotal.toFixed(0)}
        </Text>
        {job.distanceKm > 0 && (
          <Text
            style={{ fontSize: 13, color: colors.textDisabled, fontWeight: '600', marginTop: 2 }}
          >
            €{(job.priceTotal / job.distanceKm).toFixed(2)}/km
          </Text>
        )}
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.bgMuted,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
              {job.distanceKm} km
            </Text>
          </View>
          <Text
            style={{ fontSize: 13, color: colors.textDisabled, marginTop: 4, fontWeight: '600' }}
          >
            {job.time}
          </Text>
        </View>
      </View>

      {/* ── Route Visual ── */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
        <View style={{ alignItems: 'center', paddingTop: 6, width: 12 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' }} />
          <View
            style={{ width: 2, flex: 1, backgroundColor: '#000', marginVertical: 4, minHeight: 40 }}
          />
          <View style={{ width: 10, height: 10, backgroundColor: '#000' }} />
        </View>

        <View style={{ flex: 1, gap: 18 }}>
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 2,
              }}
            >
              {job.fromCity}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }} numberOfLines={1}>
              {job.fromAddress}
            </Text>
          </View>
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 2,
              }}
            >
              {job.toCity}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }} numberOfLines={1}>
              {job.toAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Bottom: Details Line ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          paddingTop: 16,
        }}
      >
        <Text
          style={{ fontSize: 13, color: '#4b5563', fontWeight: '600', flex: 1 }}
          numberOfLines={1}
        >
          {job.vehicleType} · {job.weightTonnes}t · {job.payload} · {job.date}
        </Text>
        {job.pricePerTonne > 0 && (
          <View style={{ marginLeft: 8 }}>
            <StatusPill
              label={`€${job.pricePerTonne.toFixed(2)}/t`}
              bg="#f0fdf4"
              color="#166534"
              size="sm"
            />
          </View>
        )}
        {(() => {
          const co2 = estimateCo2Kg(job.distanceKm, job.weightTonnes);
          if (!co2) return null;
          return (
            <View style={{ marginLeft: 8 }}>
              <StatusPill label={`~${formatCo2(co2)}`} bg="#f0fdf4" color="#15803d" size="sm" />
            </View>
          );
        })()}
        {job.buyerOfferedRate != null && job.buyerOfferedRate > 0 && (
          <View style={{ marginLeft: 8 }}>
            <StatusPill
              label={`Piedāvā €${job.buyerOfferedRate.toFixed(2)}`}
              bg="#eff6ff"
              color="#1d4ed8"
              size="sm"
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (tourMode) return card;

  return (
    <View style={styles.cardWrap}>
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        friction={2.5}
        rightThreshold={60}
        overshootRight={false}
      >
        {card}
      </Swipeable>
    </View>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function JobsScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [allJobs, setAllJobs] = useState<TransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<SearchFilter | null>(null);
  const [draft, setDraft] = useState<SearchFilter>({
    fromLocation: '',
    fromRadius: 0,
    toLocation: '',
    toRadius: 0,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [todayStats, setTodayStats] = useState<{ earnings: number; completed: number } | null>(
    null,
  );

  // ── View mode ─────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const mapRef = useRef<MapView>(null);

  // ── Accept sheet ──────────────────────────────────────────────
  const [acceptSheetJob, setAcceptSheetJob] = useState<TransportJob | null>(null);
  const [accepting, setAccepting] = useState(false);

  // ── Tour (multi-stop route optimisation) ──────────────────────
  const [tourMode, setTourMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [tourResult, setTourResult] = useState<{
    orderedJobs: TransportJob[];
    totalKm: number;
  } | null>(null);
  const [tourResultVisible, setTourResultVisible] = useState(false);

  // ── Avoid empty runs ──────────────────────────────────────────
  const [avoidEmptyRuns, setAvoidEmptyRuns] = useState(false);
  const [returnTripJobs, setReturnTripJobs] = useState<TransportJob[]>([]);
  const [returnTripsLoading, setReturnTripsLoading] = useState(false);
  const [lastDeliveryCoords, setLastDeliveryCoords] = useState<{
    lat: number;
    lng: number;
    city: string;
  } | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.transportJobs.available(token);
      setAllJobs(data.map(mapJob));
    } catch (e) {
      toast.error('Neizdevās ielādēt darbus');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Refresh jobs whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs]),
  );

  // Today's earnings summary
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api.transportJobs
      .myJobs(token)
      .then((jobs) => {
        if (controller.signal.aborted) return;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        let earnings = 0;
        let completed = 0;
        for (const j of jobs) {
          if (j.status === 'DELIVERED') {
            const d = new Date(j.deliveryDate ?? j.pickupDate);
            if (d >= todayStart) {
              earnings += j.rate;
              completed++;
            }
          }
        }
        setTodayStats({ earnings, completed });
      })
      .catch((err) => console.warn('Failed to load today stats:', err));
    return () => controller.abort();
  }, [token]);
  // Load saved searches on mount
  useEffect(() => {
    AsyncStorage.getItem(ASYNC_KEY).then((raw) => {
      if (raw) setSavedSearches(JSON.parse(raw));
    });
  }, []);

  // Restore last-used filter on first mount so drivers don't re-enter their radius each session
  useEffect(() => {
    AsyncStorage.getItem('@b3hub_driver_last_filter').then((raw) => {
      if (raw) {
        try {
          const f = JSON.parse(raw);
          setDraft(f);
          setActiveFilter(f);
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  // Persist saved searches
  useEffect(() => {
    AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(savedSearches));
  }, [savedSearches]);

  const filteredJobs = useMemo(() => filterJobs(allJobs, activeFilter), [allJobs, activeFilter]);

  const displayJobs = useMemo(
    () => (avoidEmptyRuns ? returnTripJobs : filteredJobs),
    [avoidEmptyRuns, returnTripJobs, filteredJobs],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const handleApply = async () => {
    setGeocoding(true);
    try {
      const [resolvedFrom, resolvedTo] = await Promise.all([
        draft.fromLocation.trim() ? geocodeLocation(draft.fromLocation) : Promise.resolve(null),
        draft.toLocation.trim() ? geocodeLocation(draft.toLocation) : Promise.resolve(null),
      ]);
      const newFilter = {
        ...draft,
        fromLat: resolvedFrom?.lat,
        fromLng: resolvedFrom?.lng,
        toLat: resolvedTo?.lat,
        toLng: resolvedTo?.lng,
      };
      setActiveFilter(newFilter);
      AsyncStorage.setItem('@b3hub_driver_last_filter', JSON.stringify(newFilter)).catch(() => {});
    } finally {
      setGeocoding(false);
      setPanelOpen(false);
    }
  };

  const handleReset = () => {
    const empty = { fromLocation: '', fromRadius: 0, toLocation: '', toRadius: 0 };
    setDraft(empty);
    setActiveFilter(null);
    AsyncStorage.removeItem('@b3hub_driver_last_filter').catch(() => {});
    setPanelOpen(false);
  };

  const handleSaveSearch = () => {
    if (!draft.fromLocation.trim() && !draft.toLocation.trim()) {
      Alert.alert('', 'Vismaz viena atrasanas vieta jabievada pirms saglabasanas.');
      return;
    }
    setSaveModalVisible(true);
  };

  const handleConfirmSave = (name: string) => {
    const ns: SavedSearch = { id: Date.now().toString(), name, ...draft };
    setSavedSearches((prev) => [ns, ...prev]);
    setSaveModalVisible(false);
    Alert.alert(t.jobSearch.searchSaved);
  };

  const handleApplySaved = async (s: SavedSearch) => {
    const f: SearchFilter = {
      fromLocation: s.fromLocation,
      fromRadius: s.fromRadius,
      toLocation: s.toLocation,
      toRadius: s.toRadius,
    };
    setDraft(f);
    // Re-geocode so lat/lng are fresh (saved searches only store text labels)
    setGeocoding(true);
    try {
      const [resolvedFrom, resolvedTo] = await Promise.all([
        f.fromLocation.trim() ? geocodeLocation(f.fromLocation) : Promise.resolve(null),
        f.toLocation.trim() ? geocodeLocation(f.toLocation) : Promise.resolve(null),
      ]);
      setActiveFilter({
        ...f,
        fromLat: resolvedFrom?.lat,
        fromLng: resolvedFrom?.lng,
        toLat: resolvedTo?.lat,
        toLng: resolvedTo?.lng,
      });
    } finally {
      setGeocoding(false);
    }
    setPanelOpen(false);
  };

  const togglePanel = () => {
    if (!panelOpen && activeFilter) setDraft({ ...activeFilter });
    setPanelOpen((v) => !v);
  };

  const handleAcceptPressed = useCallback(
    (jobId: string) => {
      const job = filteredJobs.find((j) => j.id === jobId) ?? allJobs.find((j) => j.id === jobId);
      if (!job) return;
      setAcceptSheetJob(job);
    },
    [filteredJobs, allJobs],
  );

  const handleConfirmAccept = async () => {
    if (!acceptSheetJob || !token || accepting) return;

    // Block acceptance if no vehicle registered
    try {
      const vehicles = await api.vehicles.getAll(token);
      if (!Array.isArray(vehicles) || vehicles.length === 0) {
        Alert.alert(
          'Nav reģistrētu transportlīdzekļu',
          'Pirms darba pieņemšanas, lūdzu pievienojiet transportlīdzekli profilā.',
          [
            { text: 'Atcelt', style: 'cancel' },
            {
              text: 'Pievienot',
              onPress: () => {
                setAcceptSheetJob(null);
                router.push('/(driver)/vehicles');
              },
            },
          ],
        );
        return;
      }
    } catch {
      // If check fails, allow accept rather than blocking
    }

    const job = acceptSheetJob;
    setAccepting(true);
    try {
      await api.transportJobs.accept(job.id, token);
      setAllJobs((prev) => prev.filter((j) => j.id !== job.id));
      haptics.success();
      setAcceptSheetJob(null);
      toast.success('Darbs pieņemts!');
      router.replace('/(driver)/active');
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās pieņemt darbu');
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!acceptSheetJob || !token) return;
    try {
      await api.transportJobs.declineOffer(acceptSheetJob.id, token);
      haptics.light();
    } catch {
      // silently ignore — offer still expires naturally
    } finally {
      setAcceptSheetJob(null);
    }
  };

  const handleOptimizeTour = async () => {
    const selected = allJobs.filter((j) => selectedIds.has(j.id));
    if (selected.length < 2) return;
    setOptimizing(true);
    try {
      const stops = selected.map((j) => ({ lat: j.fromLat, lng: j.fromLng, label: j.fromCity }));
      const result = await optimizeRoute(stops);
      const orderedJobs = result.visitOrder.map((i) => selected[i]);
      setTourResult({ orderedJobs, totalKm: result.totalDistanceKm });
      setTourResultVisible(true);
    } catch {
      toast.error('Neizdevās optimizēt maršrutu');
    } finally {
      setOptimizing(false);
    }
  };

  const handleToggleAvoidEmptyRuns = useCallback(async () => {
    if (avoidEmptyRuns) {
      setAvoidEmptyRuns(false);
      setReturnTripJobs([]);
      return;
    }
    if (!token) return;
    setAvoidEmptyRuns(true);
    setReturnTripsLoading(true);
    try {
      let coords = lastDeliveryCoords;
      if (!coords) {
        const jobs = await api.transportJobs.myJobs(token);
        const lastDelivered = [...jobs]
          .filter((j) => j.status === 'DELIVERED' && j.deliveryLat != null && j.deliveryLng != null)
          .sort((a, b) =>
            (b.statusUpdatedAt ?? b.deliveryDate).localeCompare(
              a.statusUpdatedAt ?? a.deliveryDate,
            ),
          )[0];
        if (
          !lastDelivered ||
          lastDelivered.deliveryLat == null ||
          lastDelivered.deliveryLng == null
        ) {
          toast.error('Nav atrasta pēdējā piegādes vieta');
          setAvoidEmptyRuns(false);
          setReturnTripsLoading(false);
          return;
        }
        coords = {
          lat: lastDelivered.deliveryLat,
          lng: lastDelivered.deliveryLng,
          city: lastDelivered.deliveryCity,
        };
        setLastDeliveryCoords(coords);
      }
      const trips = await api.transportJobs.returnTrips(coords.lat, coords.lng, 75, token);
      setReturnTripJobs(trips.map(mapJob));
    } catch {
      toast.error('Neizdevās ielādēt atpakaļceļa darbus');
      setAvoidEmptyRuns(false);
    } finally {
      setReturnTripsLoading(false);
    }
  }, [avoidEmptyRuns, token, lastDeliveryCoords]);

  const renderJobItem = useCallback(
    ({ item }: { item: TransportJob }) => (
      <JobCard
        job={item}
        onAccept={handleAcceptPressed}
        tourMode={tourMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
      />
    ),
    [handleAcceptPressed, tourMode, selectedIds],
  );

  const nearbyForSheet = useMemo(
    () =>
      acceptSheetJob
        ? nearbyJobs(acceptSheetJob.toLat, acceptSheetJob.toLng, allJobs, acceptSheetJob.id)
        : [],
    [acceptSheetJob, allJobs],
  );

  if (loading) {
    return (
      <ScreenContainer bg="#f2f2f7">
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 40, gap: 12 }}>
          <SkeletonJobRow count={5} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f2f2f7">
      {/* ── Header ────────────────────────────────────────── */}
      <ScreenHeader
        title="Darbi"
        onBack={null}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setTourMode((v) => {
                  if (v) setSelectedIds(new Set());
                  return !v;
                });
              }}
              style={[styles.filterBtn, tourMode && styles.filterBtnActive]}
              activeOpacity={0.7}
            >
              <Route size={22} color="#ffffff" />
              {tourMode && selectedIds.size > 0 && <View style={styles.filterDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setViewMode((m) => (m === 'list' ? 'map' : 'list'));
              }}
              style={styles.filterBtn}
              activeOpacity={0.7}
            >
              {viewMode === 'list' ? (
                <Map size={22} color="#ffffff" />
              ) : (
                <List size={22} color="#ffffff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePanel} style={styles.filterBtn} activeOpacity={0.7}>
              <Settings2 size={22} color="#ffffff" />
              {activeFilter && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Earnings strip ────────────────────────────────── */}
      <View style={styles.earningsStrip}>
        {todayStats !== null ? (
          <View style={styles.earningsStripInner}>
            <Text style={styles.earningsStripAmount}>€{todayStats.earnings.toFixed(0)}</Text>
            <Text style={styles.earningsStripLabel}>šodien · {todayStats.completed} paveikti</Text>
          </View>
        ) : (
          <ActivityIndicator size="small" color="#111827" />
        )}
      </View>

      {/* ── Avoid empty runs chip ──────────────────────────── */}
      <View style={styles.avoidEmptyRow}>
        <TouchableOpacity
          style={[styles.avoidEmptyChip, avoidEmptyRuns && styles.avoidEmptyChipActive]}
          onPress={handleToggleAvoidEmptyRuns}
          activeOpacity={0.75}
          disabled={returnTripsLoading}
        >
          {returnTripsLoading ? (
            <ActivityIndicator size="small" color={avoidEmptyRuns ? '#fff' : '#111827'} />
          ) : (
            <Truck size={14} color={avoidEmptyRuns ? '#fff' : '#374151'} />
          )}
          <Text
            style={[styles.avoidEmptyChipText, avoidEmptyRuns && styles.avoidEmptyChipTextActive]}
          >
            Tukšbrauciens
          </Text>
          {avoidEmptyRuns && lastDeliveryCoords && (
            <Text style={styles.avoidEmptyChipSub}>· {lastDeliveryCoords.city}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Active filter pill ────────────────────────────── */}
      {activeFilter && <ActiveFilterPill filter={activeFilter} onClear={handleReset} />}

      {/* ── Map view ─────────────────────────────────────── */}
      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: 56.9496,
              longitude: 24.1052,
              latitudeDelta: 2.5,
              longitudeDelta: 2.5,
            }}
            onMapReady={() => {
              if (displayJobs.length > 0) {
                const coords = displayJobs
                  .filter((j) => j.fromLat && j.fromLng)
                  .map((j) => ({ latitude: j.fromLat, longitude: j.fromLng }));
                if (coords.length > 0) {
                  mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
                    animated: false,
                  });
                }
              }
            }}
          >
            {displayJobs
              .filter((j) => j.fromLat && j.fromLng)
              .map((job) => (
                <Marker
                  key={job.id}
                  coordinate={{ latitude: job.fromLat, longitude: job.fromLng }}
                  title={`${job.fromCity} → ${job.toCity}`}
                  description={`€${job.priceTotal.toFixed(0)} · ${job.weightTonnes}t · ${Math.round(job.distanceKm)} km`}
                  pinColor="#111827"
                  onCalloutPress={() => handleAcceptPressed(job.id)}
                />
              ))}
          </MapView>
          {displayJobs.length === 0 && (
            <View
              style={{ position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' }}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  Nav pieejamu darbu kartē
                </Text>
              </View>
            </View>
          )}
          {displayJobs.length > 0 && (
            <View
              style={{ position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center' }}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {displayJobs.length} darb{displayJobs.length === 1 ? 's' : 'i'} — pieskarieties,
                  lai pieņemtu
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={displayJobs}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={4}
          renderItem={renderJobItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A878" />
          }
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            displayJobs.length > 0 ? (
              <View style={styles.swipeHint}>
                <Text style={styles.swipeHintText}>
                  Pieskarieties kartei vai velciet pa kreisi, lai pieņemtu darbu
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Search size={32} color="#9ca3af" />}
              title={t.jobs.empty}
              subtitle={
                avoidEmptyRuns
                  ? 'Nav pieejamu darbu netālu no pēdējās piegādes vietas'
                  : activeFilter
                    ? t.jobs.emptyDesc
                    : 'Jauni darbi parādās katru rītu. Ieslēdz paziņojumus, lai saņemtu brīdinājumus par jauniem darbiem.'
              }
              action={
                activeFilter ? (
                  <TouchableOpacity style={styles.emptyResetBtn} onPress={handleReset}>
                    <Text style={styles.emptyResetBtnText}>{t.jobSearch.resetFilter}</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          }
        />
      )}

      {/* Tour action bar — shown when tour mode is active */}
      {tourMode && (
        <View style={styles.tourBar}>
          <Text style={styles.tourBarText}>
            {selectedIds.size > 0
              ? `${selectedIds.size} darb${selectedIds.size === 1 ? 's' : 'i'} izvēlēti`
              : 'Izvēlieties darbus maršrutam'}
          </Text>
          {selectedIds.size >= 2 && (
            <TouchableOpacity
              style={[styles.tourOptBtn, optimizing && { opacity: 0.6 }]}
              onPress={handleOptimizeTour}
              disabled={optimizing}
              activeOpacity={0.8}
            >
              {optimizing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.tourOptBtnText}>Optimizēt maršrutu</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tour result sheet */}
      <BottomSheet
        visible={tourResultVisible}
        onClose={() => setTourResultVisible(false)}
        title="Optimizēts maršruts"
        scrollable
      >
        {tourResult && (
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <View style={styles.tourTotalRow}>
              <Route size={16} color="#111827" />
              <Text style={styles.tourTotalText}>
                Kopā ~{tourResult.totalKm > 0 ? `${tourResult.totalKm} km` : 'aprēķina...'}
              </Text>
            </View>
            {tourResult.orderedJobs.map((job, idx) => (
              <View key={job.id} style={styles.tourStopRow}>
                <View style={styles.tourStopIndex}>
                  <Text style={styles.tourStopIndexText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tourStopRoute}>
                    {job.fromCity} → {job.toCity}
                  </Text>
                  <Text style={styles.tourStopMeta}>
                    {job.jobNumber} · €{job.priceTotal.toFixed(0)} · {Math.round(job.distanceKm)} km
                  </Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.tourDoneBtn}
              onPress={() => {
                setTourResultVisible(false);
                setTourMode(false);
                setSelectedIds(new Set());
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.tourDoneBtnText}>Pabeigt</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* Save-search modal */}
      <SaveSearchModal
        visible={saveModalVisible}
        filter={draft}
        onSave={handleConfirmSave}
        onClose={() => setSaveModalVisible(false)}
      />
      {/* Filter sheet */}
      <FilterSheet
        visible={panelOpen}
        draft={draft}
        onChange={setDraft}
        savedSearches={savedSearches}
        onApply={handleApply}
        applyLoading={geocoding}
        onReset={handleReset}
        onSaveSearch={handleSaveSearch}
        onApplySaved={handleApplySaved}
        onDeleteSaved={(id) => setSavedSearches((prev) => prev.filter((s) => s.id !== id))}
        onClose={() => setPanelOpen(false)}
      />
      {/* Accept bottom sheet */}
      <AcceptBottomSheet
        visible={!!acceptSheetJob}
        job={acceptSheetJob}
        nearby={nearbyForSheet}
        onConfirm={handleConfirmAccept}
        loading={accepting}
        onDecline={handleDeclineOffer}
        onClose={() => {
          if (!accepting) setAcceptSheetJob(null);
        }}
      />
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header filter button (rightAction)
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Earnings strip (below ScreenHeader)
  earningsStrip: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: colors.bgCard,
  },
  earningsStripInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  earningsStripAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  earningsStripLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },

  scrollContent: { paddingBottom: 120, paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  activePillLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  activePillText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  activePillClear: {
    backgroundColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillClearText: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  resultsCount: { fontSize: 13, fontWeight: '600', color: colors.textDisabled },
  sortLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },

  swipeHint: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 0,
  },
  swipeHintText: {
    fontSize: 12,
    color: colors.textDisabled,
    fontWeight: '500',
    textAlign: 'center',
  },

  cardWrap: {
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  cardSelected: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  tourCheckWrap: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
  },
  tourCheckEmpty: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: colors.bgCard,
  },
  // Sub-styles for card content
  routeCity: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  routeAddress: { fontSize: 13, color: colors.textMuted },
  priceTotal: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  pricePerTonne: { fontSize: 12, color: colors.textDisabled, fontWeight: '500' },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  jobNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDisabled,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  emptyResetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.bgSubtle,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#4b5563' },
  modalSave: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // ── Accept Bottom Sheet ────────────────────────────────────────
  sheetJobCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  sheetJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetJobNum: { fontSize: 13, fontWeight: '700', color: colors.textDisabled },
  sheetJobPrice: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  sheetRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  sheetRouteDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sheetRouteCity: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  sheetJobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sheetMetaText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  sheetMetaDot: { fontSize: 12, color: '#d1d5db' },
  sheetReturnSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 8,
    gap: 8,
  },
  sheetReturnTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  sheetReturnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  sheetReturnLeft: { flex: 1, gap: 4 },
  sheetReturnKmBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sheetReturnKmText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  sheetReturnCity: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sheetReturnPrice: { fontSize: 16, fontWeight: '800', color: '#166534', marginLeft: 8 },
  sheetReturnNone: {
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    paddingVertical: 8,
  },
  sheetAcceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetAcceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  sheetDeclineBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  sheetDeclineBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  // ── Tour route optimisation ────────────────────────────────────
  filterBtnActive: {
    backgroundColor: '#111827',
  },
  tourBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  tourBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  tourOptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  tourOptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tourTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  tourTotalText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  tourStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tourStopIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  tourStopIndexText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  tourStopRoute: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  tourStopMeta: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  tourDoneBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  tourDoneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Avoid empty runs chip ─────────────────────────────────────
  avoidEmptyRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  avoidEmptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avoidEmptyChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  avoidEmptyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  avoidEmptyChipTextActive: {
    color: '#fff',
  },
  avoidEmptyChipSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
});

// ── Map styles ────────────────────────────────────────────────────────────────
const mapStyles = StyleSheet.create({
  // Swipe-to-accept action (used by JobCard)
  swipeAccept: {
    width: 88,
    backgroundColor: '#059669',
    borderRadius: 16,
    marginLeft: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  swipeAcceptText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
