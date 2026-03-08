/**
 * skips.tsx — Carrier: manage assigned skip-hire orders
 *
 * Two views toggled from the header:
 *   LIST — scrollable cards (original view)
 *   MAP  — interactive Mapbox map with pins for every skip order.
 *           Red pin    = to deliver (CONFIRMED)
 *           Purple pin = to collect (DELIVERED)
 *           Tapping a pin slides up a bottom sheet order card.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import {
  Trash2,
  MapPin,
  Phone,
  Calendar,
  Navigation2,
  CheckCircle2,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  List,
  Map,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, SkipHireOrder, SkipHireStatus } from '@/lib/api';
import { BaseMap } from '@/components/map';
import { t } from '@/lib/translations';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#dc2626';
const RIGA: [number, number] = [24.1052, 56.9496];
const SCREEN_H = Dimensions.get('window').height;
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const GEOCODE_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const cs = t.carrierSkips;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function openMaps(address: string) {
  const enc = encodeURIComponent(address);
  const url = Platform.OS === 'ios' ? `maps:?q=${enc}` : `geo:0,0?q=${enc}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${enc}`));
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url =
      `${GEOCODE_BASE}/${encodeURIComponent(address)}.json` +
      `?country=lv,lt,ee&limit=1&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    const c = json.features?.[0]?.center as [number, number] | undefined;
    return c ?? null;
  } catch {
    return null;
  }
}

function pinColor(status: string): string {
  if (status === 'CONFIRMED') return '#dc2626';
  if (status === 'DELIVERED') return '#7c3aed';
  return '#6b7280';
}

// ── DetailRow ─────────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      {icon}
      <Text style={s.detailLabel}>{label}:</Text>
      <Text style={s.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: SkipHireOrder;
  onStatusUpdate: (id: string, status: SkipHireStatus) => void;
  updating: boolean;
  flat?: boolean;
}

function OrderCard({ order, onStatusUpdate, updating, flat = false }: OrderCardProps) {
  const [expanded, setExpanded] = useState(flat);

  const statusInfo = cs.status[order.status] ?? { label: order.status, bg: '#f3f4f6', color: '#374151' };
  const sizeLabel = cs.sizes[order.skipSize] ?? order.skipSize;
  const wasteLabel = cs.wasteTypes[order.wasteCategory] ?? order.wasteCategory;
  const canDeliver = order.status === 'CONFIRMED';
  const canCollect = order.status === 'DELIVERED';

  const confirm = () => {
    if (canDeliver) {
      Alert.alert(cs.confirmDelivery, cs.confirmDeliveryMsg, [
        { text: cs.cancel, style: 'cancel' },
        { text: cs.confirm, onPress: () => onStatusUpdate(order.id, 'DELIVERED') },
      ]);
    } else if (canCollect) {
      Alert.alert(cs.confirmCollection, cs.confirmCollectionMsg, [
        { text: cs.cancel, style: 'cancel' },
        { text: cs.confirm, onPress: () => onStatusUpdate(order.id, 'COLLECTED') },
      ]);
    }
  };

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.cardHeader}
        onPress={flat ? undefined : () => setExpanded((e) => !e)}
        activeOpacity={flat ? 1 : 0.7}
      >
        <View style={[s.iconBox, { backgroundColor: statusInfo.bg }]}>
          <Trash2 size={22} color={statusInfo.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.titleRow}>
            <Text style={s.orderNumber}>{order.orderNumber}</Text>
            <View style={[s.badge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[s.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>
          <View style={s.metaRow}>
            <MapPin size={13} color="#6b7280" />
            <Text style={s.metaText} numberOfLines={1}>{order.location}</Text>
          </View>
          <View style={s.metaRow}>
            <Package size={13} color="#6b7280" />
            <Text style={s.metaText}>{sizeLabel}</Text>
            <Calendar size={13} color="#6b7280" style={{ marginLeft: 10 }} />
            <Text style={s.metaText}>{formatDate(order.deliveryDate)}</Text>
          </View>
        </View>
        {!flat && (expanded ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />)}
      </TouchableOpacity>

      {(expanded || flat) && (
        <View style={s.expandedBody}>
          <View style={s.divider} />
          <DetailRow icon={<Package size={14} color="#6b7280" />} label={cs.size} value={sizeLabel} />
          <DetailRow icon={<Trash2 size={14} color="#6b7280" />} label={cs.wasteType} value={wasteLabel} />
          <DetailRow icon={<MapPin size={14} color="#6b7280" />} label={cs.address} value={order.location} />
          <DetailRow icon={<Calendar size={14} color="#6b7280" />} label={cs.deliveryDate} value={formatDate(order.deliveryDate)} />
          {order.contactName && (
            <DetailRow icon={<Phone size={14} color="#6b7280" />} label={cs.client} value={order.contactName} />
          )}
          {order.contactPhone && (
            <DetailRow icon={<Phone size={14} color="#6b7280" />} label={cs.phone} value={order.contactPhone} />
          )}
          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>{order.notes}</Text>
            </View>
          ) : null}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.navBtn} onPress={() => openMaps(order.location)} activeOpacity={0.8}>
              <Navigation2 size={15} color={ACCENT} />
              <Text style={s.navBtnText}>{cs.navigate}</Text>
            </TouchableOpacity>
            {order.contactPhone ? (
              <TouchableOpacity
                style={s.callBtn}
                onPress={() => Linking.openURL(`tel:${order.contactPhone!}`)}
                activeOpacity={0.8}
              >
                <Phone size={15} color="#374151" />
                <Text style={s.callBtnText}>{cs.call}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {(canDeliver || canCollect) && (
            <TouchableOpacity
              style={[s.statusBtn, updating && { opacity: 0.5 }]}
              onPress={confirm}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle2 size={17} color="#fff" />
                  <Text style={s.statusBtnText}>{canDeliver ? cs.markDelivered : cs.markCollected}</Text>
                  <ArrowRight size={15} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Map view ──────────────────────────────────────────────────────────────────

interface MapViewProps {
  orders: SkipHireOrder[];
  onStatusUpdate: (id: string, status: SkipHireStatus) => void;
  updatingId: string | null;
}

function SkipsMapView({ orders, onStatusUpdate, updatingId }: MapViewProps) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [selected, setSelected] = useState<SkipHireOrder | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Geocode every order whose coords we don't have yet
  useEffect(() => {
    const missing = orders.filter((o) => !coords[o.id]);
    if (missing.length === 0) return;

    setGeocoding(true);
    Promise.all(
      missing.map(async (o) => ({ id: o.id, coord: await geocodeAddress(o.location) })),
    ).then((results) => {
      const next: Record<string, [number, number]> = { ...coords };
      results.forEach(({ id, coord }) => { if (coord) next[id] = coord; });
      setCoords(next);
      setGeocoding(false);

      const all = Object.values(next);
      if (all.length === 0 || !cameraRef.current) return;
      if (all.length === 1) {
        cameraRef.current.setCamera({ centerCoordinate: all[0], zoomLevel: 14, animationDuration: 600 });
      } else {
        const lngs = all.map((c) => c[0]);
        const lats = all.map((c) => c[1]);
        cameraRef.current.fitBounds(
          [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
          [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
          [80, 80, 80, 80],
          600,
        );
      }
    });
  }, [orders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSheet = (order: SkipHireOrder) => {
    setSelected(order);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setSelected(null),
    );
  };

  const sheetY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });
  const resolved = orders.filter((o) => coords[o.id]);

  return (
    <View style={{ flex: 1 }}>
      <BaseMap cameraRef={cameraRef} center={RIGA} zoom={9}>
        {resolved.map((order) => (
          <MapboxGL.PointAnnotation
            key={order.id}
            id={order.id}
            coordinate={coords[order.id]!}
            onSelected={() => openSheet(order)}
          >
            <View collapsable={false}>
              <View style={[s.mapPin, { backgroundColor: pinColor(order.status) }]}>
                <Trash2 size={13} color="#fff" />
              </View>
              <View style={[s.mapPinTail, { borderTopColor: pinColor(order.status) }]} />
            </View>
          </MapboxGL.PointAnnotation>
        ))}
      </BaseMap>

      {geocoding && (
        <View style={s.geocodeOverlay}>
          <ActivityIndicator color={ACCENT} size="small" />
          <Text style={s.geocodeText}>Ielādē adreses…</Text>
        </View>
      )}

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#dc2626' }]} />
          <Text style={s.legendLabel}>Piegādāt</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#7c3aed' }]} />
          <Text style={s.legendLabel}>Savākt</Text>
        </View>
        <Text style={s.legendCount}>{resolved.length}/{orders.length}</Text>
      </View>

      {selected && (
        <>
          <TouchableOpacity style={s.backdrop} onPress={closeSheet} activeOpacity={1} />
          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>#{selected.orderNumber}</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={10}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: SCREEN_H * 0.55 }} showsVerticalScrollIndicator={false}>
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <OrderCard
                  order={selected}
                  onStatusUpdate={(id, status) => { closeSheet(); onStatusUpdate(id, status); }}
                  updating={updatingId === selected.id}
                  flat
                />
              </View>
            </ScrollView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CarrierSkipsScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.skipHire.carrierOrders(token);
        setOrders(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const handleStatusUpdate = useCallback(
    async (id: string, newStatus: SkipHireStatus) => {
      if (!token) return;
      setUpdatingId(id);
      try {
        const updated = await api.skipHire.updateCarrierStatus(id, newStatus, token);
        setOrders((prev) =>
          newStatus === 'COLLECTED'
            ? prev.filter((o) => o.id !== id)
            : prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)),
        );
      } catch (err: any) {
        Alert.alert(cs.errorTitle, err?.message ?? 'Neizdevās atjaunināt statusu.');
      } finally {
        setUpdatingId(null);
      }
    },
    [token],
  );

  const toDeliver = orders.filter((o) => o.status === 'CONFIRMED');
  const toCollect = orders.filter((o) => o.status === 'DELIVERED');

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{cs.title}</Text>
          <Text style={s.headerSubtitle}>{cs.subtitle}</Text>
        </View>
        <View style={s.headerRight}>
          <View style={s.toggle}>
            <TouchableOpacity
              style={[s.toggleBtn, viewMode === 'list' && s.toggleActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={16} color={viewMode === 'list' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, viewMode === 'map' && s.toggleActive]}
              onPress={() => setViewMode('map')}
            >
              <Map size={16} color={viewMode === 'map' ? '#fff' : '#6b7280'} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => load()} style={s.refreshBtn} hitSlop={8} disabled={loading}>
            <RefreshCw size={20} color={loading ? '#d1d5db' : ACCENT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Summary chips ── */}
      {!loading && orders.length > 0 && (
        <View style={s.chipRow}>
          {toDeliver.length > 0 && (
            <View style={[s.chip, { backgroundColor: '#fee2e2' }]}>
              <Text style={[s.chipText, { color: '#dc2626' }]}>{toDeliver.length} jāpiegādā</Text>
            </View>
          )}
          {toCollect.length > 0 && (
            <View style={[s.chip, { backgroundColor: '#f3e8ff' }]}>
              <Text style={[s.chipText, { color: '#7c3aed' }]}>{toCollect.length} jāsavāc</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : orders.length === 0 ? (
        <View style={s.center}>
          <Trash2 size={52} color="#d1d5db" />
          <Text style={s.emptyTitle}>{cs.empty}</Text>
          <Text style={s.emptyDesc}>{cs.emptyDesc}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
            <RefreshCw size={15} color={ACCENT} />
            <Text style={s.retryText}>{cs.refresh}</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' ? (
        <SkipsMapView orders={orders} onStatusUpdate={handleStatusUpdate} updatingId={updatingId} />
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {toDeliver.length > 0 && (
            <>
              <Text style={s.section}>Jāpiegādā ({toDeliver.length})</Text>
              {toDeliver.map((o) => (
                <OrderCard key={o.id} order={o} onStatusUpdate={handleStatusUpdate} updating={updatingId === o.id} />
              ))}
            </>
          )}
          {toCollect.length > 0 && (
            <>
              <Text style={[s.section, toDeliver.length > 0 && { marginTop: 20 }]}>
                Jāsavāc ({toCollect.length})
              </Text>
              {toCollect.map((o) => (
                <OrderCard key={o.id} order={o} onStatusUpdate={handleStatusUpdate} updating={updatingId === o.id} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshBtn: { padding: 8 },

  toggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3, gap: 3 },
  toggleBtn: { width: 34, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: ACCENT },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 10 },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20, marginTop: 4 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: ACCENT },
  retryText: { color: ACCENT, fontWeight: '600', fontSize: 14 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10 },
  section: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingHorizontal: 2 },

  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 13, color: '#6b7280', flexShrink: 1 },

  expandedBody: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 7 },
  detailLabel: { fontSize: 13, color: '#6b7280', minWidth: 80 },
  detailValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1 },
  notesBox: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 10, marginBottom: 10 },
  notesText: { fontSize: 13, color: '#713f12' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 10, paddingVertical: 9 },
  navBtnText: { color: ACCENT, fontWeight: '600', fontSize: 13 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 9 },
  callBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 13 },
  statusBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },

  mapPin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  mapPinTail: { alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },

  geocodeOverlay: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  geocodeText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  legend: { position: 'absolute', bottom: 20, left: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: '#374151', fontWeight: '500' },
  legendCount: { fontSize: 11, color: '#9ca3af' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d1d5db', alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
});
