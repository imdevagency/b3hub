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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Swipeable: any = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const swipeRef = useRef<any>(null);

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
      <Text style={mapStyles.swipeAcceptText}>Piemēņem</Text>
    </TouchableOpacity>
  );

  const card = (
    <TouchableOpacity
      style={[styles.card, tourMode && selected && styles.cardSelected]}
      activeOpacity={tourMode ? 0.7 : 0.97}
      onPress={tourMode ? () => onToggleSelect?.(job.id) : undefined}
    >
      {/* Tour selection indicator */}
      {tourMode && (
        <View style={styles.tourCheckWrap}>
          {selected ? (
            <CheckCircle2 size={22} color="#111827" />
          ) : (
            <View style={styles.tourCheckEmpty} />
          )}
        </View>
      )}
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.jobNumber}>{job.jobNumber}</Text>
          <View style={styles.vehicleRow}>
            <Truck size={16} color="#6b7280" />
            <Text style={styles.vehicleType}>{job.vehicleType}</Text>
          </View>
        </View>
        <View style={styles.availableBadge}>
          <Text style={styles.availableBadgeText}>{t.jobs.available}</Text>
        </View>
      </View>

      {/* Payload pill */}
      <View style={styles.payloadRow}>
        <Text style={styles.payloadWeight}>{job.weightTonnes} t</Text>
        <View style={styles.payloadDot} />
        <Text style={styles.payloadMaterial}>{job.payload}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <View style={styles.routeDotFrom} />
          <View>
            <Text style={styles.routeCity}>{job.fromCity}</Text>
            <Text style={styles.routeAddress}>{job.fromAddress}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={styles.routeDotTo} />
          <View>
            <Text style={styles.routeCity}>{job.toCity}</Text>
            <Text style={styles.routeAddress}>{job.toAddress}</Text>
          </View>
        </View>
      </View>

      {/* Meta: date, distance, price */}
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Calendar size={14} color="#6b7280" />
          <View>
            <Text style={styles.metaValue}>{job.date}</Text>
            <Text style={styles.metaSub}>{job.time}</Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <Ruler size={14} color="#6b7280" />
          <Text style={styles.metaValue}>{job.distanceKm} km</Text>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.priceTotal}>
            {job.priceTotal.toFixed(2)} {job.currency}
          </Text>
          <Text style={styles.pricePerTonne}>
            {job.pricePerTonne.toFixed(2)} {job.currency}
            {t.jobs.perTonne}
          </Text>
        </View>
      </View>

      {/* Accept button — hidden in tour-select mode */}
      {!tourMode && (
        <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(job.id)}>
          <Text style={styles.acceptBtnText}>{t.jobs.accept}</Text>
        </TouchableOpacity>
      )}
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
    } catch (err: any) {
      haptics.error();
      Alert.alert('Kļūda', err.message ?? 'Neizdevās pieņemt darbu');
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f2f2f7">
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 12 }}>
          <SkeletonJobRow count={5} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f3f4f6">
      {/* ── Minimal floating controls ── */}
      <View style={styles.controlsRow}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={14} color={viewMode === 'list' ? '#111827' : '#6b7280'} />
            <Text
              style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}
            >
              Saraksts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Map size={14} color={viewMode === 'map' ? '#111827' : '#6b7280'} />
            <Text
              style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}
            >
              Karte
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'list' && (
          <TouchableOpacity
            style={[styles.filterBtn, panelOpen && styles.filterBtnActive]}
            onPress={togglePanel}
          >
            <Settings2 size={15} color={panelOpen ? '#111827' : '#6b7280'} />
            {activeFilter && <View style={styles.filterDot} />}
          </TouchableOpacity>
        )}
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

          {/* Results header */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>{t.jobSearch.results(filteredJobs.length)}</Text>
            <Text style={styles.sortLabel}>
              {t.jobSearch.sortNewest} {'↓'}
            </Text>
          </View>

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
      {/* end map/list conditional */}
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
      {/* How It Works modal removed — tukšbrauciens lives in active.tsx */}
      {/* ── GO ONLINE FAB ── */}
      <View style={styles.onlineFabWrap} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.onlineFab, isOnline === true && styles.onlineFabOnline]}
          onPress={handleToggleOnline}
          disabled={togglingOnline || isOnline === null}
          activeOpacity={0.82}
        >
          <View style={[styles.onlineFabDot, isOnline === true && styles.onlineFabDotActive]} />
          <Text style={[styles.onlineFabLabel, isOnline === true && styles.onlineFabLabelOnline]}>
            {togglingOnline ? '...' : isOnline === true ? 'Tiešsaistē' : 'IET TIEŠSAISTĒ'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  // ── Controls row (minimal, light) ──────────────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: '#d1d5db' },
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    padding: 3,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  viewToggleText: { fontSize: 12, fontWeight: '600', color: '#6b7280', lineHeight: 18 },
  viewToggleTextActive: { color: '#111827' },

  // ── GO ONLINE FAB ──────────────────────────────────────────────────────────
  onlineFabWrap: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  onlineFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111827',
    paddingVertical: 17,
    borderRadius: 50,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  onlineFabOnline: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowOpacity: 0.08,
  },
  onlineFabDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6b7280' },
  onlineFabDotActive: { backgroundColor: '#34d399' },
  onlineFabLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.6,
    lineHeight: 20,
  },
  onlineFabLabelOnline: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0,
  },

  scrollContent: { paddingBottom: 104, flexGrow: 1 },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  activePillLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  activePillText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#78350f' },
  activePillClear: {
    backgroundColor: '#9ca3af',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillClearText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 2,
  },
  resultsCount: { fontSize: 13, fontWeight: '700', color: '#374151' },
  sortLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },

  list: { paddingHorizontal: 16 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#111827',
    backgroundColor: '#f0fdf4',
  },
  tourCheckWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 5,
  },
  tourCheckEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: { gap: 4 },
  jobNumber: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleIcon: { fontSize: 18 },
  vehicleType: { fontSize: 15, fontWeight: '700', color: '#111827' },
  availableBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  availableBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  payloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  payloadWeight: { fontSize: 14, fontWeight: '800', color: '#111827' },
  payloadDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#9ca3af' },
  payloadMaterial: { fontSize: 14, fontWeight: '500', color: '#374151' },

  routeSection: { gap: 0, paddingLeft: 2 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3 },
  routeDotFrom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 2.5,
    borderColor: '#bbf7d0',
  },
  routeDotTo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 2.5,
    borderColor: '#fca5a5',
  },
  routeLine: { width: 2, height: 14, backgroundColor: '#e5e7eb', marginLeft: 5 },
  routeCity: { fontSize: 14, fontWeight: '700', color: '#111827' },
  routeAddress: { fontSize: 12, color: '#9ca3af' },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaIcon: { fontSize: 14 },
  metaValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
  metaSub: { fontSize: 11, color: '#9ca3af' },
  priceBlock: { alignItems: 'flex-end' },
  priceTotal: { fontSize: 19, fontWeight: '800', color: '#111827' },
  pricePerTonne: { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  acceptBtn: {
    backgroundColor: '#111827',
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  emptyResetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  modalSave: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  // ── Accept Bottom Sheet ────────────────────────────────────────
  sheetJobCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sheetJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetJobNum: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  sheetJobPrice: { fontSize: 20, fontWeight: '800', color: '#111827' },
  sheetRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  sheetRouteDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  sheetRouteCity: { fontSize: 14, fontWeight: '700', color: '#111827', flexShrink: 1 },
  sheetJobMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  sheetMetaText: { fontSize: 12, color: '#6b7280' },
  sheetMetaDot: { fontSize: 12, color: '#d1d5db' },
  sheetReturnSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d1fae5',
    gap: 6,
  },
  sheetReturnTitle: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  sheetReturnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  sheetReturnLeft: { flex: 1, gap: 4 },
  sheetReturnKmBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sheetReturnKmText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  sheetReturnCity: { fontSize: 13, fontWeight: '600', color: '#111827' },
  sheetReturnPrice: { fontSize: 15, fontWeight: '800', color: '#059669', marginLeft: 8 },
  sheetReturnNone: { fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  sheetAcceptBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetAcceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
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
