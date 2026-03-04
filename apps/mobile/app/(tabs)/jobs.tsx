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
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob } from '@/lib/api';
import {
  Map,
  MapPin,
  Navigation2,
  Calendar,
  Ruler,
  Settings2,
  Search,
  Truck,
  X,
} from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TransportJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  payload: string;
  weightTonnes: number;
  fromCity: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toCity: string;
  toAddress: string;
  toLat: number;
  toLng: number;
  distanceKm: number;
  date: string;
  time: string;
  priceTotal: number;
  pricePerTonne: number;
  currency: string;
  status: 'AVAILABLE';
}

interface SearchFilter {
  fromLocation: string;
  fromRadius: number; // km, 0 = any
  toLocation: string;
  toRadius: number;
}

interface SavedSearch extends SearchFilter {
  id: string;
  name: string;
}

// ── Latvian city coords (haversine radius filtering) ──────────────────────────
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  riga: { lat: 56.9496, lng: 24.1052 },
  jurmala: { lat: 56.9677, lng: 23.7718 },
  ogre: { lat: 56.8153, lng: 24.6037 },
  sigulda: { lat: 57.1534, lng: 24.86 },
  ventspils: { lat: 57.3914, lng: 21.5614 },
  jelgava: { lat: 56.649, lng: 23.7124 },
  liepaja: { lat: 56.5114, lng: 21.0107 },
  daugavpils: { lat: 55.8749, lng: 26.5363 },
  valmiera: { lat: 57.5405, lng: 25.4229 },
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityCoords(input: string): { lat: number; lng: number } | null {
  const key = input
    .toLowerCase()
    .trim()
    .replace(/[āa]/g, 'a')
    .replace(/[ēe]/g, 'e')
    .replace(/[īi]/g, 'i')
    .replace(/[ūu]/g, 'u')
    .replace(/[ģg]/g, 'g')
    .replace(/[ķk]/g, 'k')
    .replace(/[ļl]/g, 'l')
    .replace(/[ņn]/g, 'n')
    .replace(/[šs]/g, 's')
    .replace(/[žz]/g, 'z');
  return (
    CITY_COORDS[key] ??
    Object.entries(CITY_COORDS).find(([k]) => k.includes(key) || key.includes(k))?.[1] ??
    null
  );
}

// ── Map API response → local shape ──────────────────────────────────────────
function mapJob(j: ApiTransportJob): TransportJob {
  const d = new Date(j.pickupDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    vehicleType: j.requiredVehicleType ?? '',
    payload: j.cargoType,
    weightTonnes: j.cargoWeight ?? 0,
    fromCity: j.pickupCity,
    fromAddress: j.pickupAddress,
    fromLat: j.pickupLat ?? 0,
    fromLng: j.pickupLng ?? 0,
    toCity: j.deliveryCity,
    toAddress: j.deliveryAddress,
    toLat: j.deliveryLat ?? 0,
    toLng: j.deliveryLng ?? 0,
    distanceKm: j.distanceKm ?? 0,
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    priceTotal: j.rate,
    pricePerTonne: j.pricePerTonne ?? 0,
    currency: j.currency,
    status: 'AVAILABLE',
  };
}

const RADIUS_OPTIONS = [25, 50, 100, 150, 200];
const ASYNC_KEY = 'b3hub_saved_job_searches';

// ── Filter logic ──────────────────────────────────────────────────────────────
function filterJobs(jobs: TransportJob[], filter: SearchFilter | null): TransportJob[] {
  if (!filter) return jobs;
  const { fromLocation, fromRadius, toLocation, toRadius } = filter;
  return jobs.filter((job) => {
    if (fromLocation.trim() && fromRadius > 0) {
      const coords = cityCoords(fromLocation);
      if (coords) {
        const dist = haversineKm(coords.lat, coords.lng, job.fromLat, job.fromLng);
        if (dist > fromRadius) return false;
      }
    }
    if (toLocation.trim() && toRadius > 0) {
      const coords = cityCoords(toLocation);
      if (coords) {
        const dist = haversineKm(coords.lat, coords.lng, job.toLat, job.toLng);
        if (dist > toRadius) return false;
      }
    }
    return true;
  });
}

// ── Radius chips ──────────────────────────────────────────────────────────────
function RadiusRow({ selected, onChange }: { selected: number; onChange: (v: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiusScroll}>
      <View style={styles.radiusChips}>
        <TouchableOpacity
          style={[styles.chip, selected === 0 && styles.chipActive]}
          onPress={() => onChange(0)}
        >
          <Text style={[styles.chipText, selected === 0 && styles.chipTextActive]}>
            {t.jobSearch.any}
          </Text>
        </TouchableOpacity>
        {RADIUS_OPTIONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, selected === r && styles.chipActive]}
            onPress={() => onChange(r)}
          >
            <Text style={[styles.chipText, selected === r && styles.chipTextActive]}>{r} km</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ── "Drive wherever you want" banner ─────────────────────────────────────────
function DriveWhereverBanner({ onSetRadius }: { onSetRadius: () => void }) {
  return (
    <View style={styles.banner}>
      <Map size={32} color="#6b7280" style={{ marginTop: 2 }} />
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{t.jobSearch.driveTitle}</Text>
        <Text style={styles.bannerDesc}>{t.jobSearch.driveDesc}</Text>
        <TouchableOpacity style={styles.bannerBtn} onPress={onSetRadius}>
          <Text style={styles.bannerBtnText}>
            {t.jobSearch.setRadius} {'→'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{t.jobSearch.savedSearchTitle}</Text>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Search panel ──────────────────────────────────────────────────────────────
function SearchPanel({
  draft,
  onChange,
  savedSearches,
  onApply,
  onReset,
  onSaveSearch,
  onApplySaved,
  onDeleteSaved,
}: {
  draft: SearchFilter;
  onChange: (f: SearchFilter) => void;
  savedSearches: SavedSearch[];
  onApply: () => void;
  onReset: () => void;
  onSaveSearch: () => void;
  onApplySaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void;
}) {
  return (
    <View style={styles.panel}>
      {/* From location */}
      <View style={styles.panelSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <MapPin size={13} color="#9ca3af" />
          <Text style={styles.panelLabel}>{t.jobSearch.fromLocation}</Text>
        </View>
        <TextInput
          style={styles.panelInput}
          value={draft.fromLocation}
          onChangeText={(v) => onChange({ ...draft, fromLocation: v })}
          placeholder={t.jobSearch.fromPlaceholder}
          placeholderTextColor="#6b7280"
          returnKeyType="done"
        />
        <RadiusRow
          selected={draft.fromRadius}
          onChange={(v) => onChange({ ...draft, fromRadius: v })}
        />
      </View>

      {/* To location */}
      <View style={[styles.panelSection, { marginTop: 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <Navigation2 size={13} color="#9ca3af" />
          <Text style={styles.panelLabel}>{t.jobSearch.toLocation}</Text>
        </View>
        <TextInput
          style={styles.panelInput}
          value={draft.toLocation}
          onChangeText={(v) => onChange({ ...draft, toLocation: v })}
          placeholder={t.jobSearch.toPlaceholder}
          placeholderTextColor="#6b7280"
          returnKeyType="done"
        />
        <RadiusRow
          selected={draft.toRadius}
          onChange={(v) => onChange({ ...draft, toRadius: v })}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.panelActions}>
        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
          <Text style={styles.resetBtnText}>{t.jobSearch.resetFilter}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.applyBtnText}>{t.jobSearch.applyFilter}</Text>
        </TouchableOpacity>
      </View>

      {/* Save search */}
      <TouchableOpacity style={styles.saveSearchBtn} onPress={onSaveSearch}>
        <Text style={styles.saveSearchBtnText}>{t.jobSearch.saveSearch}</Text>
      </TouchableOpacity>

      {/* Saved searches chips */}
      {savedSearches.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedTitle}>{t.jobSearch.savedSearches}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.savedChips}>
              {savedSearches.map((s) => (
                <View key={s.id} style={styles.savedChip}>
                  <TouchableOpacity onPress={() => onApplySaved(s)}>
                    <Text style={styles.savedChipText}>{s.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDeleteSaved(s.id)}
                    style={styles.savedChipDelete}
                  >
                    <X size={11} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onAccept }: { job: TransportJob; onAccept: (id: string) => void }) {
  return (
    <View style={styles.card}>
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
            <Text style={styles.metaSub}>{job.time} Uhr</Text>
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

      {/* Accept button */}
      <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(job.id)}>
        <Text style={styles.acceptBtnText}>{t.jobs.accept}</Text>
      </TouchableOpacity>
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

  const panelAnim = useRef(new Animated.Value(0)).current;

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.transportJobs.available(token);
      setAllJobs(data.map(mapJob));
    } catch (e) {
      console.error('Failed to load jobs', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
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

  // Animate panel
  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: panelOpen ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [panelOpen]);

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

  const handleAccept = (jobId: string) => {
    if (!token) return;
    Alert.alert(t.jobs.accepted, t.jobs.acceptedDesc, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Pieņemt',
        onPress: async () => {
          try {
            await api.transportJobs.accept(jobId, token);
            setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
            router.replace('/(tabs)/active');
          } catch (err: any) {
            Alert.alert('Kļūda', err.message ?? 'Neizdevās pieņemt darbu');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>{t.jobs.title}</Text>
        <TouchableOpacity
          style={[styles.filterToggle, panelOpen && styles.filterToggleActive]}
          onPress={togglePanel}
        >
          <Settings2 size={14} color={panelOpen ? '#ffffff' : '#9ca3af'} />
          <Text style={[styles.filterToggleText, panelOpen && styles.filterToggleTextActive]}>
            {t.jobSearch.filterTitle}
          </Text>
          {activeFilter && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Collapsible search panel */}
        <Animated.View
          style={[
            styles.panelWrapper,
            {
              maxHeight: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 700] }),
              opacity: panelAnim,
            },
          ]}
        >
          <SearchPanel
            draft={draft}
            onChange={setDraft}
            savedSearches={savedSearches}
            onApply={handleApply}
            onReset={handleReset}
            onSaveSearch={handleSaveSearch}
            onApplySaved={handleApplySaved}
            onDeleteSaved={(id) => setSavedSearches((prev) => prev.filter((s) => s.id !== id))}
          />
        </Animated.View>

        {/* Active filter pill */}
        {activeFilter && !panelOpen && (
          <ActiveFilterPill filter={activeFilter} onClear={handleReset} />
        )}

        {/* "Drive wherever you want" banner — only when no filter set */}
        {!activeFilter && !panelOpen && (
          <DriveWhereverBanner onSetRadius={() => setPanelOpen(true)} />
        )}

        {/* Results header */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{t.jobSearch.results(filteredJobs.length)}</Text>
          <Text style={styles.sortLabel}>
            {t.jobSearch.sortNewest} {'↓'}
          </Text>
        </View>

        {/* Job list */}
        {filteredJobs.length === 0 ? (
          <View style={styles.empty}>
            <Search size={44} color="#d1d5db" />
            <Text style={styles.emptyTitle}>{t.jobs.empty}</Text>
            <Text style={styles.emptyDesc}>{t.jobs.emptyDesc}</Text>
            <TouchableOpacity style={styles.emptyResetBtn} onPress={handleReset}>
              <Text style={styles.emptyResetBtnText}>{t.jobSearch.resetFilter}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} onAccept={handleAccept} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Save-search modal */}
      <SaveSearchModal
        visible={saveModalVisible}
        filter={draft}
        onSave={handleConfirmSave}
        onClose={() => setSaveModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#1f2937',
  },
  screenTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterToggleActive: { backgroundColor: '#dc2626' },
  filterToggleText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  filterToggleTextActive: { color: '#ffffff' },
  filterDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fbbf24' },

  scrollContent: { paddingBottom: 32 },
  panelWrapper: { overflow: 'hidden' },

  panel: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  panelSection: {},
  panelLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  panelInput: {
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#f9fafb',
    marginBottom: 8,
  },

  radiusScroll: { marginBottom: 2 },
  radiusChips: { flexDirection: 'row', gap: 6, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  chipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  chipTextActive: { color: '#ffffff' },

  panelActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  saveSearchBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  saveSearchBtnText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },

  savedSection: { marginTop: 14 },
  savedTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  savedChips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  savedChipText: { fontSize: 13, fontWeight: '600', color: '#e5e7eb' },
  savedChipDelete: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChipDeleteText: { fontSize: 11, color: '#9ca3af', fontWeight: '700' },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  activePillLabel: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  activePillText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#78350f' },
  activePillClear: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillClearText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  bannerEmoji: { fontSize: 30, marginTop: 2 },
  bannerBody: { flex: 1, gap: 6 },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  bannerDesc: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  bannerBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bannerBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6b7280',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  routeDotTo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  routeLine: { width: 2, height: 12, backgroundColor: '#e5e7eb', marginLeft: 4 },
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
  priceTotal: { fontSize: 19, fontWeight: '800', color: '#dc2626' },
  pricePerTonne: { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  acceptBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#dc2626',
  },
  emptyResetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
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
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
