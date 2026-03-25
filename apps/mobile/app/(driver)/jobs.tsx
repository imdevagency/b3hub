import React, { useState, useCallback, useEffect, useRef } from 'react';

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonJobRow } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterSheet } from '@/components/driver/FilterSheet';
import { JobMapView } from '@/components/driver/JobMapView';
import {
  type TransportJob,
  type SearchFilter,
  type SavedSearch,
  ASYNC_KEY,
  filterJobs,
  mapJob,
  nearbyJobs,
} from '@/components/driver/job-types';
import {
  Calendar,
  Ruler,
  Settings2,
  Search,
  Truck,
  Route,
  CheckCircle2,
  ChevronRight,
  Map,
  List,
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
  onClose,
}: {
  visible: boolean;
  job: TransportJob | null;
  nearby: { job: TransportJob; gapKm: number }[];
  onConfirm: () => void;
  onClose: () => void;
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
        <TouchableOpacity style={styles.sheetAcceptBtn} onPress={onConfirm}>
          <Text style={styles.sheetAcceptBtnText}>{t.jobs.acceptAndGo}</Text>
        </TouchableOpacity>
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
      activeOpacity={tourMode ? 0.8 : 0.96}
      onPress={tourMode ? () => onToggleSelect?.(job.id) : undefined}
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

      {/* ── Top Row: Price (Prominent) & JobID ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', lineHeight: 30 }}>
            €{job.priceTotal.toFixed(0)}
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500', marginTop: 2 }}>
            {job.distanceKm} km • {job.pricePerTonne.toFixed(2)}/t
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#f3f4f6',
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 6,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#4b5563' }}>
              #{job.jobNumber}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{job.time}</Text>
        </View>
      </View>

      {/* ── Route Visual ── */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        {/* Visual Line */}
        <View style={{ alignItems: 'center', paddingTop: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' }} />
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: '#e5e7eb',
              marginVertical: 4,
              minHeight: 28,
            }}
          />
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 3,
              borderColor: '#111827',
              backgroundColor: '#fff',
            }}
          />
        </View>

        {/* Address Text */}
        <View style={{ flex: 1, gap: 18 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
              {job.fromCity}
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>
              {job.fromAddress}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{job.toCity}</Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>
              {job.toAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Bottom: Vehicle Info Chip ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: '#f3f4f6',
          }}
        >
          <Truck size={14} color="#4b5563" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
            {job.vehicleType} • {job.weightTonnes}t
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: '500' }}>{job.payload}</Text>
      </View>
    </TouchableOpacity>
  );

  if (tourMode) return card;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2.5}
      rightThreshold={60}
      overshootRight={false}
    >
      {card}
    </Swipeable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function JobsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  // ── Online / Offline toggle ───────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // ── View mode ─────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // ── Driver location (for map) ──────────────────────────────────
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [mapRadius, setMapRadius] = useState<number>(100);

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
  const [todayStats, setTodayStats] = useState<{ earnings: number; completed: number } | null>(
    null,
  );

  // ── Accept sheet ──────────────────────────────────────────────
  const [acceptSheetJob, setAcceptSheetJob] = useState<TransportJob | null>(null);

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

  // Load online status on mount
  useEffect(() => {
    if (!token) return;
    api.driverSchedule
      .getStatus(token)
      .then((s) => setIsOnline(s.isOnline))
      .catch(() => setIsOnline(false));
  }, [token]);

  const handleToggleOnline = async () => {
    if (!token || togglingOnline || isOnline === null) return;
    setTogglingOnline(true);
    try {
      const res = await api.driverSchedule.toggleOnline(!isOnline, token);
      setIsOnline(res.isOnline);
    } catch (e) {
      Alert.alert('Kļūda', 'Neizdevās mainīt statusu');
    } finally {
      setTogglingOnline(false);
    }
  };

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

  // Persist saved searches
  useEffect(() => {
    AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(savedSearches));
  }, [savedSearches]);

  // Driver GPS for map view
  useEffect(() => {
    if (viewMode !== 'map') return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        (loc) => {
          setDriverLat(loc.coords.latitude);
          setDriverLng(loc.coords.longitude);
        },
      );
    })();
    return () => {
      sub?.remove();
    };
  }, [viewMode]);

  const filteredJobs = filterJobs(allJobs, activeFilter);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const handleApply = () => {
    setActiveFilter({ ...draft });
    setPanelOpen(false);
  };

  const handleReset = () => {
    const empty = { fromLocation: '', fromRadius: 0, toLocation: '', toRadius: 0 };
    setDraft(empty);
    setActiveFilter(null);
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
    if (!acceptSheetJob || !token) return;
    if (isOnline === false) {
      Alert.alert('Bezsaistē', 'Lai pieņemtu darbu, jums jābūt tiešsaistē.', [
        { text: 'Atcelt', style: 'cancel' },
        { text: 'Iet tiešsaistē', onPress: handleToggleOnline },
      ]);
      return;
    }
    const jobId = acceptSheetJob.id;
    setAcceptSheetJob(null);
    try {
      await api.transportJobs.accept(jobId, token);
      setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
      haptics.success();
      router.replace('/(driver)/active');
    } catch (err: unknown) {
      haptics.error();
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās pieņemt darbu');
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="white">
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 40, gap: 12 }}>
          <SkeletonJobRow count={5} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="white" standalone>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827', letterSpacing: -1 }}>
          Brīvie darbi
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 }}>
          <TouchableOpacity
            style={[styles.pill, viewMode === 'list' && styles.pillActive]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[styles.pillText, viewMode === 'list' && styles.pillTextActive]}>
              Saraksts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, viewMode === 'map' && styles.pillActive]}
            onPress={() => setViewMode('map')}
          >
            <Text style={[styles.pillText, viewMode === 'map' && styles.pillTextActive]}>
              Karte
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {viewMode === 'list' && (
            <TouchableOpacity
              style={[styles.iconBtn, panelOpen && { backgroundColor: '#f3f4f6' }]}
              onPress={togglePanel}
            >
              <Settings2 size={20} color="#111827" />
              {activeFilter && <View style={styles.filterDot} />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Map view */}
      {viewMode === 'map' ? (
        <JobMapView
          jobs={filteredJobs}
          driverLat={driverLat}
          driverLng={driverLng}
          mapRadius={mapRadius}
          onRadiusChange={setMapRadius}
          onJobSelect={setAcceptSheetJob}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Active filter pill */}
          {activeFilter && <ActiveFilterPill filter={activeFilter} onClear={handleReset} />}

          {/* Job list */}
          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={<Search size={32} color="#9ca3af" />}
              title={t.jobs.empty}
              subtitle={t.jobs.emptyDesc}
              action={
                <TouchableOpacity style={styles.emptyResetBtn} onPress={handleReset}>
                  <Text style={styles.emptyResetBtnText}>{t.jobSearch.resetFilter}</Text>
                </TouchableOpacity>
              }
            />
          ) : (
            <View style={styles.list}>
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onAccept={handleAcceptPressed} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

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
        onClose={() => setAcceptSheetJob(null)}
      />

      {/* ── GO ONLINE FAB ── */}
      <View style={styles.onlineFabWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.goBtn, isOnline && styles.goBtnOnline, togglingOnline && { opacity: 0.8 }]}
          onPress={handleToggleOnline}
          disabled={togglingOnline || isOnline === null}
          activeOpacity={0.8}
        >
          {togglingOnline ? (
            <ActivityIndicator color={isOnline ? '#000' : '#fff'} />
          ) : (
            <Text style={[styles.goBtnText, isOnline && styles.goBtnTextOnline]}>
              {isOnline ? 'TIEŠSAISTĒ' : 'GO'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  pillActive: {
    backgroundColor: '#111827',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // GO Button
  onlineFabWrap: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  goBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#111827', // Black (or Uber blue #276EF1)
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 4,
    borderColor: '#fff',
  },
  goBtnOnline: {
    width: 'auto',
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: '#dcfce7', // Green-ish pill
    borderWidth: 0,
    shadowOpacity: 0.1,
  },
  goBtnText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  goBtnTextOnline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },

  scrollContent: { paddingBottom: 120, flexGrow: 1 },

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

  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
