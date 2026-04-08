import React, { useState, useCallback, useEffect, useRef } from 'react';

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
import {
  type TransportJob,
  type SearchFilter,
  type SavedSearch,
  ASYNC_KEY,
  filterJobs,
  mapJob,
  nearbyJobs,
} from '@/components/driver/job-types';
import { geocodeLocation } from '@/lib/maps';
import {
  Settings2,
  Search,
  Truck,
  CheckCircle2,
  ChevronRight,
  Ruler,
  Route,
} from 'lucide-react-native';
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
            <View style={[styles.sheetRouteDot, { backgroundColor: '#111827' }]} />
            <Text style={styles.sheetRouteCity}>{j.fromCity}</Text>
            <ChevronRight size={14} color="#9ca3af" />
            <View style={[styles.sheetRouteDot, { backgroundColor: '#111827' }]} />
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
function JobCard({
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
            color: '#111827',
            lineHeight: 36,
            letterSpacing: -0.5,
          }}
        >
          €{job.priceTotal.toFixed(0)}
        </Text>
        {job.distanceKm > 0 && (
          <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '600', marginTop: 2 }}>
            €{(job.priceTotal / job.distanceKm).toFixed(2)}/km
          </Text>
        )}
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#f3f4f6',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
              {job.distanceKm} km
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4, fontWeight: '600' }}>
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 }}>
              {job.fromCity}
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280' }} numberOfLines={1}>
              {job.fromAddress}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 }}>
              {job.toCity}
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280' }} numberOfLines={1}>
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
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function JobsScreen() {
  const { token } = useAuth();
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

  // ── Accept sheet ──────────────────────────────────────────────
  const [acceptSheetJob, setAcceptSheetJob] = useState<TransportJob | null>(null);
  const [accepting, setAccepting] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.transportJobs.available(token);
      setAllJobs(data.map(mapJob));
    } catch (e) {
      Alert.alert('Kļūda', 'Neizdevās ielādēt darbus');
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
    api.transportJobs
      .myJobs(token)
      .then((jobs) => {
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
      .catch(() => {});
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

  const filteredJobs = filterJobs(allJobs, activeFilter);

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

  const handleApplySaved = (s: SavedSearch) => {
    const f: SearchFilter = {
      fromLocation: s.fromLocation,
      fromRadius: s.fromRadius,
      toLocation: s.toLocation,
      toRadius: s.toRadius,
    };
    setDraft(f);
    setActiveFilter(f);
    setPanelOpen(false);
  };

  const togglePanel = () => {
    if (!panelOpen && activeFilter) setDraft({ ...activeFilter });
    setPanelOpen((v) => !v);
  };

  const handleAcceptPressed = (jobId: string) => {
    const job = filteredJobs.find((j) => j.id === jobId) ?? allJobs.find((j) => j.id === jobId);
    if (!job) return;
    setAcceptSheetJob(job);
  };

  const handleConfirmAccept = async () => {
    if (!acceptSheetJob || !token || accepting) return;
    const job = acceptSheetJob;
    setAccepting(true);
    try {
      await api.transportJobs.accept(job.id, token);
      setAllJobs((prev) => prev.filter((j) => j.id !== job.id));
      haptics.success();
      setAcceptSheetJob(null);

      // Post-accept: offer immediate navigation to pickup
      const lat = job.fromLat || null;
      const lng = job.fromLng || null;
      const label = `${job.fromCity ?? job.fromAddress ?? ''}`.trim();
      const openUrl = (url: string, fallback: string) =>
        Linking.canOpenURL(url)
          .then((ok) => Linking.openURL(ok ? url : fallback))
          .catch(() => {});
      const googleFallback =
        lat != null && lng != null
          ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
          : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}&travelmode=driving`;
      const navOptions =
        lat != null && lng != null
          ? [
              {
                text: 'Waze',
                onPress: () => openUrl(`waze://?ll=${lat},${lng}&navigate=yes`, googleFallback),
              },
              {
                text: 'Google Maps',
                onPress: () =>
                  openUrl(
                    Platform.OS === 'ios'
                      ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
                      : `google.navigation:q=${lat},${lng}&mode=d`,
                    googleFallback,
                  ),
              },
              ...(Platform.OS === 'ios'
                ? [
                    {
                      text: 'Apple Maps',
                      onPress: () =>
                        openUrl(`maps://?daddr=${lat},${lng}&dirflg=d`, googleFallback),
                    },
                  ]
                : []),
            ]
          : [
              {
                text: 'Google Maps',
                onPress: () => Linking.openURL(googleFallback).catch(() => {}),
              },
            ];

      Alert.alert(
        'Darbs pieņemts!',
        label ? `Doties uz iekraušanu — ${label}?` : 'Vai atvērt navigāciju uz iekraušanas vietu?',
        [
          ...navOptions,
          {
            text: 'Vēlāk',
            style: 'cancel',
            onPress: () => router.replace('/(driver)/active'),
          },
        ],
        {
          onDismiss: () => router.replace('/(driver)/active'),
        },
      );
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās pieņemt darbu');
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
          <TouchableOpacity onPress={togglePanel} style={styles.filterBtn} activeOpacity={0.7}>
            <Settings2 size={22} color="#111827" />
            {activeFilter && <View style={styles.filterDot} />}
          </TouchableOpacity>
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

      {/* ── Active filter pill ────────────────────────────── */}
      {activeFilter && <ActiveFilterPill filter={activeFilter} onClear={handleReset} />}

      <FlatList
        style={{ flex: 1 }}
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JobCard job={item} onAccept={handleAcceptPressed} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          filteredJobs.length > 0 ? (
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>Pieskarieties kartei vai velciet pa kreisi, lai pieņemtu darbu</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Search size={32} color="#9ca3af" />}
            title={t.jobs.empty}
            subtitle={
              activeFilter
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
        nearby={
          acceptSheetJob
            ? nearbyJobs(acceptSheetJob.toLat, acceptSheetJob.toLng, allJobs, acceptSheetJob.id)
            : []
        }
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
    backgroundColor: '#f3f4f6',
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
    borderColor: '#ffffff',
  },

  // Earnings strip (below ScreenHeader)
  earningsStrip: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  earningsStripInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  earningsStripAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
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
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  activePillLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  activePillText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#111827' },
  activePillClear: {
    backgroundColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillClearText: { fontSize: 11, fontWeight: '700', color: '#111827' },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  resultsCount: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  sortLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },

  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },

  swipeHint: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 0,
  },
  swipeHintText: {
    fontSize: 12,
    color: '#9ca3af',
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
    padding: 24,
    overflow: 'hidden',
  },
  cardSelected: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#111827',
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  // Sub-styles for card content
  routeCity: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  routeAddress: { fontSize: 13, color: '#6b7280' },
  priceTotal: { fontSize: 22, fontWeight: '800', color: '#111827' },
  pricePerTonne: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  jobNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  emptyResetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#4b5563' },
  modalSave: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  // ── Accept Bottom Sheet ────────────────────────────────────────
  sheetJobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  sheetJobNum: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  sheetJobPrice: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sheetRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  sheetRouteDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sheetRouteCity: { fontSize: 16, fontWeight: '700', color: '#111827', flexShrink: 1 },
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
  sheetReturnCity: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sheetReturnPrice: { fontSize: 16, fontWeight: '800', color: '#166534', marginLeft: 8 },
  sheetReturnNone: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  sheetAcceptBtn: {
    backgroundColor: '#111827',
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
