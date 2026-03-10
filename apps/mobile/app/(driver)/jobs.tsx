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
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
// Lazy-load: native module not available in Expo Go
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapboxGL = require('@rnmapbox/maps').default;
} catch {
  /* Expo Go */
}
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonJobRow } from '@/components/ui/Skeleton';

import {
  MapPin,
  Navigation2,
  Calendar,
  Ruler,
  Settings2,
  Search,
  Truck,
  X,
  Route,
  CheckCircle2,
  ChevronRight,
  Map,
  List,
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

// Return trip extends normal job with distance from the anchor (delivery destination)
interface ReturnTripJob extends TransportJob {
  returnDistanceKm: number;
}

const RADIUS_OPTIONS = [25, 50, 100, 150, 200];
const ASYNC_KEY = 'b3hub_saved_job_searches';

// Nearest available jobs to a given point (for the accept bottom sheet)
function nearbyJobs(
  lat: number,
  lng: number,
  allJobs: TransportJob[],
  excludeId: string,
  topN = 3,
): { job: TransportJob; gapKm: number }[] {
  return allJobs
    .filter((j) => j.id !== excludeId && j.fromLat && j.fromLng)
    .map((j) => ({ job: j, gapKm: Math.round(haversineKm(lat, lng, j.fromLat, j.fromLng)) }))
    .sort((a, b) => a.gapKm - b.gapKm)
    .slice(0, topN);
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

// ── Accept Bottom Sheet ───────────────────────────────────────────────────────
function AcceptBottomSheet({
  job,
  nearby,
  onConfirm,
  onClose,
}: {
  job: TransportJob;
  nearby: { job: TransportJob; gapKm: number }[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetOverlayTouch} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheetContainer}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetTitle}>{t.jobs.acceptSheetTitle}</Text>

          {/* Job summary */}
          <View style={styles.sheetJobCard}>
            <View style={styles.sheetJobHeader}>
              <Text style={styles.sheetJobNum}>{job.jobNumber}</Text>
              <Text style={styles.sheetJobPrice}>€{job.priceTotal.toFixed(0)}</Text>
            </View>
            <View style={styles.sheetRouteRow}>
              <View style={[styles.sheetRouteDot, { backgroundColor: '#111827' }]} />
              <Text style={styles.sheetRouteCity}>{job.fromCity}</Text>
              <ChevronRight size={14} color="#9ca3af" />
              <View style={[styles.sheetRouteDot, { backgroundColor: '#111827' }]} />
              <Text style={styles.sheetRouteCity}>{job.toCity}</Text>
            </View>
            <View style={styles.sheetJobMeta}>
              <Truck size={12} color="#9ca3af" />
              <Text style={styles.sheetMetaText}>{job.vehicleType}</Text>
              <Text style={styles.sheetMetaDot}>·</Text>
              <Ruler size={12} color="#9ca3af" />
              <Text style={styles.sheetMetaText}>{job.distanceKm} km</Text>
              <Text style={styles.sheetMetaDot}>·</Text>
              <Text style={styles.sheetMetaText}>{job.weightTonnes} t</Text>
            </View>
          </View>

          {/* Return suggestions */}
          {nearby.length > 0 && (
            <View style={styles.sheetReturnSection}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}
              >
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
      </View>
    </Modal>
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
  return (
    <TouchableOpacity
      style={[styles.card, tourMode && selected && styles.cardSelected]}
      activeOpacity={tourMode ? 0.7 : 1}
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
}

// ── Job Map View ─────────────────────────────────────────────────────────────
function pinColor(distKm: number | null): string {
  if (distKm === null) return '#6b7280';
  if (distKm < 50) return '#111827';
  if (distKm < 120) return '#9ca3af';
  return '#111827';
}

interface JobMapViewProps {
  jobs: TransportJob[];
  driverLat: number | null;
  driverLng: number | null;
  mapRadius: number;
  onRadiusChange: (r: number) => void;
  onJobSelect: (job: TransportJob) => void;
}

function JobMapView({
  jobs,
  driverLat,
  driverLng,
  mapRadius,
  onRadiusChange,
  onJobSelect,
}: JobMapViewProps) {
  const centerLat = driverLat ?? 56.946;
  const centerLng = driverLng ?? 24.105; // Riga default

  const visibleJobs = jobs.filter((j) => {
    if (driverLat === null || driverLng === null) return true;
    return haversineKm(driverLat, driverLng, j.fromLat, j.fromLng) <= mapRadius;
  });

  if (!MapboxGL) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#e5e7eb',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          centerCoordinate={[centerLng, centerLat]}
          zoomLevel={driverLat ? 7 : 6}
          animationDuration={500}
        />

        {/* Driver location dot */}
        {driverLat !== null && driverLng !== null && (
          <MapboxGL.UserLocation visible androidRenderMode="gps" />
        )}

        {/* Job pickup pins */}
        {visibleJobs.map((job) => {
          const distKm =
            driverLat !== null && driverLng !== null
              ? haversineKm(driverLat, driverLng, job.fromLat, job.fromLng)
              : null;
          const color = pinColor(distKm);
          return (
            <MapboxGL.PointAnnotation
              key={job.id}
              id={`pin-${job.id}`}
              coordinate={[job.fromLng, job.fromLat]}
              onSelected={() => onJobSelect(job)}
            >
              <View style={[mapStyles.pin, { backgroundColor: color }]}>
                <Text style={mapStyles.pinPrice}>{job.priceTotal.toFixed(0)}€</Text>
              </View>
              <MapboxGL.Callout title="" />
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>

      {/* Radius chips overlay */}
      <View style={mapStyles.radiusOverlay}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={mapStyles.radiusChipsRow}
        >
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[mapStyles.radiusChip, mapRadius === r && mapStyles.radiusChipActive]}
              onPress={() => onRadiusChange(r)}
            >
              <Text
                style={[
                  mapStyles.radiusChipText,
                  mapRadius === r && mapStyles.radiusChipTextActive,
                ]}
              >
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Job count badge */}
      <View style={mapStyles.countBadge}>
        <Text style={mapStyles.countBadgeText}>{visibleJobs.length} darbi</Text>
      </View>

      {/* Legend */}
      <View style={mapStyles.legend}>
        {[
          { color: '#111827', label: '<50 km' },
          { color: '#9ca3af', label: '50–120 km' },
          { color: '#111827', label: '>120 km' },
        ].map((item) => (
          <View key={item.label} style={mapStyles.legendItem}>
            <View style={[mapStyles.legendDot, { backgroundColor: item.color }]} />
            <Text style={mapStyles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
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
  const [todayStats, setTodayStats] = useState<{ earnings: number; completed: number } | null>(null);

  // ── Accept sheet ──────────────────────────────────────────────
  const [acceptSheetJob, setAcceptSheetJob] = useState<TransportJob | null>(null);

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

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Today's earnings summary
  useEffect(() => {
    if (!token) return;
    api.transportJobs.myJobs(token).then((jobs) => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      let earnings = 0;
      let completed = 0;
      for (const j of jobs) {
        if (j.status === 'DELIVERED') {
          const d = new Date(j.deliveryDate ?? j.pickupDate);
          if (d >= todayStart) { earnings += j.rate; completed++; }
        }
      }
      setTodayStats({ earnings, completed });
    }).catch(() => {});
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

  // Animate panel
  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: panelOpen ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [panelOpen]);

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
      <ScreenContainer bg="#f3f4f6">
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>{t.jobs.title}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <SkeletonJobRow count={5} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f3f4f6">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.screenTitle}>{t.jobs.title}</Text>
          {/* Online status pill */}
          <TouchableOpacity
            style={[
              styles.onlinePill,
              isOnline === true && styles.onlinePillActive,
              isOnline === false && styles.onlinePillOffline,
            ]}
            onPress={handleToggleOnline}
            disabled={togglingOnline || isOnline === null}
          >
            <View
              style={[
                styles.onlineDot,
                isOnline === true && styles.onlineDotActive,
                isOnline === false && styles.onlineDotOffline,
              ]}
            />
            <Text style={[styles.onlinePillText, isOnline === true && styles.onlinePillTextActive]}>
              {togglingOnline ? '...' : isOnline === true ? 'Tiešsaistē' : 'Bezsaistē'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Map / List toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={14} color={viewMode === 'list' ? '#ffffff' : '#9ca3af'} />
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
              <Map size={14} color={viewMode === 'map' ? '#ffffff' : '#9ca3af'} />
              <Text
                style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}
              >
                Karte
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter button — list mode only */}
          {viewMode === 'list' && (
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
          )}
        </View>
      </View>
      {/* Offline banner */}
      {isOnline === false && (
        <TouchableOpacity
          style={styles.offlineBanner}
          onPress={handleToggleOnline}
          activeOpacity={0.85}
        >
          <Text style={styles.offlineBannerText}>
            ⚫ Jūs esat bezsaistē — darbi nav redzami pieņemšanai
          </Text>
          <Text style={styles.offlineBannerCta}>Iet tiešsaistē →</Text>
        </TouchableOpacity>
      )}
      {/* Today's earnings summary */}
      {todayStats !== null && (
        <View style={styles.earningsBar}>
          <View style={styles.earningsBarItem}>
            <Text style={styles.earningsBarValue}>
              €{todayStats.earnings.toFixed(todayStats.earnings % 1 === 0 ? 0 : 2)}
            </Text>
            <Text style={styles.earningsBarLabel}>Šodien</Text>
          </View>
          <View style={styles.earningsBarDivider} />
          <View style={styles.earningsBarItem}>
            <Text style={styles.earningsBarValue}>{todayStats.completed}</Text>
            <Text style={styles.earningsBarLabel}>Kravas šodien</Text>
          </View>
          <TouchableOpacity
            style={styles.earningsBarCta}
            onPress={() => router.push('/(driver)/earnings')}
          >
            <Text style={styles.earningsBarCtaText}>Visi ienākumi →</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Map view */}}
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
                <JobCard key={job.id} job={job} onAccept={handleAcceptPressed} />
              ))}
            </View>
          )}
        </ScrollView>
      )}{' '}
      {/* end map/list conditional */}
      {/* Save-search modal */}
      <SaveSearchModal
        visible={saveModalVisible}
        filter={draft}
        onSave={handleConfirmSave}
        onClose={() => setSaveModalVisible(false)}
      />
      {/* Accept bottom sheet */}
      {acceptSheetJob && (
        <AcceptBottomSheet
          job={acceptSheetJob}
          nearby={nearbyJobs(
            acceptSheetJob.toLat,
            acceptSheetJob.toLng,
            allJobs,
            acceptSheetJob.id,
          )}
          onConfirm={handleConfirmAccept}
          onClose={() => setAcceptSheetJob(null)}
        />
      )}
      {/* How It Works modal removed — tukšbrauciens lives in active.tsx */}
    </ScreenContainer>
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
  filterToggleActive: { backgroundColor: '#111827' },
  filterToggleText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  filterToggleTextActive: { color: '#ffffff' },
  filterDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9ca3af' },

  // ── Online toggle ─────────────────────────────────────────────
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  onlinePillActive: { backgroundColor: '#111827', borderColor: '#111827' },
  onlinePillOffline: { backgroundColor: '#374151', borderColor: '#4b5563' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6b7280' },
  onlineDotActive: { backgroundColor: '#9ca3af' },
  onlineDotOffline: { backgroundColor: '#6b7280' },
  onlinePillText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  onlinePillTextActive: { color: '#d1d5db' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1917',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#292524',
  },
  offlineBannerText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  offlineBannerCta: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 20,
    padding: 3,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
  },
  viewToggleBtnActive: { backgroundColor: '#111827' },
  viewToggleText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  viewToggleTextActive: { color: '#ffffff' },

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
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
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
    backgroundColor: '#111827',
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

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#111827',
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
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  // ── Accept Bottom Sheet ────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetOverlayTouch: { flex: 1 },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
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
  pin: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pinPrice: { fontSize: 12, fontWeight: '800', color: '#ffffff' },

  radiusOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  radiusChipsRow: { flexDirection: 'row', gap: 8 },
  radiusChip: {
    backgroundColor: 'rgba(31,41,55,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  radiusChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  radiusChipText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  radiusChipTextActive: { color: '#ffffff' },

  countBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(31,41,55,0.88)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: '#f9fafb' },

  legend: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(31,41,55,0.88)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, fontWeight: '600', color: '#d1d5db' },

  // Earnings bar
  earningsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 0,
  },
  earningsBarItem: { alignItems: 'center', paddingHorizontal: 12 },
  earningsBarValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  earningsBarLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
  earningsBarDivider: { width: 1, height: 32, backgroundColor: '#374151' },
  earningsBarCta: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#374151', borderRadius: 10 },
  earningsBarCtaText: { fontSize: 12, fontWeight: '700', color: '#e5e7eb' },
});
