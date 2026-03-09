import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Phone,
  User,
  Package,
  Truck,
  FileText,
  CheckCircle,
  XCircle,
  Star,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, JobLocation } from '@/lib/api';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { t } from '@/lib/translations';
import { RatingModal } from '@/components/ui/RatingModal';

// ── Constants ──────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida', bg: '#fef9c3', color: '#a16207' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', color: '#1d4ed8' },
  PROCESSING: { label: 'Apstrādā', bg: '#ede9fe', color: '#6d28d9' },
  SHIPPED: { label: 'Ceļā', bg: '#e0f2fe', color: '#0284c7' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', color: '#15803d' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', color: '#b91c1c' },
};

const UNIT_SHORT: Record<string, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Detail Row ─────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [jobLoc, setJobLoc] = useState<JobLocation | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      // orders.myOrders returns all, find by id
      const all = await api.orders.myOrders(token);
      const found = all.find((o) => o.id === id) ?? null;
      setOrder(found);
      // Check if already rated (only for DELIVERED)
      if (found?.status === 'DELIVERED') {
        try {
          const { reviewed } = await api.reviews.status({ orderId: id }, token);
          setAlreadyRated(reviewed);
        } catch {
          // Non-critical — leave as false
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll driver GPS while order is in transit
  useEffect(() => {
    const liveJob = order?.transportJobs?.find(
      (j) =>
        j.status === 'EN_ROUTE_DELIVERY' ||
        j.status === 'AT_DELIVERY' ||
        j.status === 'LOADED' ||
        j.status === 'EN_ROUTE_PICKUP' ||
        j.status === 'AT_PICKUP',
    );

    if (!liveJob || !token) {
      setDriverLoc(null);
      setJobLoc(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const poll = async () => {
      try {
        const data = await api.transportJobs.getLocation(liveJob.id, token);
        setJobLoc(data);
        if (data.currentLocation) {
          setDriverLoc({ lat: data.currentLocation.lat, lng: data.currentLocation.lng });
        }
      } catch { /* silent — don’t disrupt buyer UX */ }
    };

    poll();
    pollingRef.current = setInterval(poll, 10_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [order, token]);

  const handleCancel = () => {
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt pasūtījumu',
        style: 'destructive',
        onPress: async () => {
          if (!token || !order) return;
          setActionLoading(true);
          try {
            const updated = await api.orders.cancel(order.id, token);
            setOrder(updated);
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atcelt');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pasūtījums</Text>
          <View style={{ width: 22 }} />
        </View>
        <ActivityIndicator style={{ marginTop: 80 }} size="large" color="#dc2626" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pasūtījums</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.emptyWrap}>
          <Package size={48} color="#9ca3af" />
          <Text style={s.emptyText}>Pasūtījums nav atrasts</Text>
        </View>
      </SafeAreaView>
    );
  }

  const st = STATUS_MAP[order.status] ?? STATUS_MAP.PENDING;
  const activeJob = order.transportJobs?.find(
    (j) => j.status === 'EN_ROUTE_DELIVERY' || j.status === 'AT_DELIVERY' || j.status === 'LOADED',
  );
  const driver = activeJob?.driver;
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {order.orderNumber}
        </Text>
        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[s.statusBadgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Live driver tracking map */}
        {activeJob && driverLoc &&
          jobLoc?.pickupLat != null && jobLoc.deliveryLat != null && (
          <View style={s.trackingCard}>
            <View style={s.trackingHeader}>
              <Truck size={14} color="#dc2626" />
              <Text style={s.trackingTitle}>Tiešraides atrašanās vieta</Text>
              <View style={s.liveTag}>
                <Text style={s.liveTagText}>TIEŠRAIDE</Text>
              </View>
            </View>
            <JobRouteMap
              pickup={{
                lat: jobLoc.pickupLat,
                lng: jobLoc.pickupLng ?? 0,
                label: 'Iekraušana',
              }}
              delivery={{
                lat: jobLoc.deliveryLat,
                lng: jobLoc.deliveryLng ?? 0,
                label: 'Piegāde',
              }}
              current={driverLoc}
              showToPickupLeg={false}
              height={220}
            />
          </View>
        )}

        {/* Driver card — if order is in transit */}
        {driver && (
          <View style={s.driverCard}>
            <View style={s.driverCardRow}>
              <Truck size={18} color="#dc2626" />
              <Text style={s.driverTitle}>Šoferis ceļā</Text>
            </View>
            <View style={s.driverInfo}>
              <User size={14} color="#dc2626" />
              <Text style={s.driverName}>
                {driver.firstName} {driver.lastName}
              </Text>
              {driver.phone ? (
                <TouchableOpacity
                  style={s.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${driver.phone}`).catch(() =>
                      Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                    )
                  }
                >
                  <Phone size={13} color="#fff" />
                  <Text style={s.callBtnText}>Zvanīt</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Order items */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Package size={14} color="#6b7280" />
            <Text style={s.sectionTitle}>Preces</Text>
          </View>
          {order.items.map((item, idx) => (
            <View key={idx} style={[s.itemRow, idx < order.items.length - 1 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.material.name}</Text>
                <Text style={s.itemMeta}>
                  {item.quantity} {UNIT_SHORT[item.unit] ?? item.unit} × €
                  {item.unitPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={s.itemTotal}>€{item.total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Kopā</Text>
            <Text style={s.totalValue}>
              €{order.total.toFixed(2)} {order.currency}
            </Text>
          </View>
        </View>

        {/* Delivery details */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MapPin size={14} color="#6b7280" />
            <Text style={s.sectionTitle}>Piegādes dati</Text>
          </View>
          <Row label="Adrese" value={order.deliveryAddress} />
          <Row label="Pilsēta" value={order.deliveryCity} />
          <Row label="Datums" value={order.deliveryDate ? formatDate(order.deliveryDate) : null} />
          <Row label="Kontaktpersona" value={order.siteContactName} />
          <Row label="Tālrunis" value={order.siteContactPhone} />
          {order.siteContactPhone && (
            <TouchableOpacity
              style={s.callSiteBtn}
              onPress={() => Linking.openURL(`tel:${order.siteContactPhone}`).catch(() => null)}
              activeOpacity={0.8}
            >
              <Phone size={13} color="#374151" />
              <Text style={s.callSiteBtnText}>Zvanīt kontaktpersonai</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Buyer info */}
        {order.buyer && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <User size={14} color="#6b7280" />
              <Text style={s.sectionTitle}>Pasūtītājs</Text>
            </View>
            <Row label="Vārds" value={`${order.buyer.firstName} ${order.buyer.lastName}`} />
            <Row label="Tālrunis" value={order.buyer.phone} />
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {order.status === 'PENDING' && (
            <View style={s.pendingNote}>
              <FileText size={14} color="#a16207" />
              <Text style={s.pendingText}>Pasūtījums gaida apstiprinājumu</Text>
            </View>
          )}
          {order.status === 'DELIVERED' && (
            <View style={s.deliveredNote}>
              <CheckCircle size={14} color="#15803d" />
              <Text style={s.deliveredText}>Pasūtījums piegādāts!</Text>
            </View>
          )}
          {order.status === 'DELIVERED' && !alreadyRated && (
            <TouchableOpacity
              style={s.rateBtn}
              onPress={() => setShowRating(true)}
              activeOpacity={0.85}
            >
              <Star size={16} color="#fff" fill="#fff" />
              <Text style={s.rateBtnText}>{t.rating.rateBtn}</Text>
            </TouchableOpacity>
          )}
          {order.status === 'DELIVERED' && alreadyRated && (
            <View style={s.alreadyRated}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={s.alreadyRatedText}>{t.rating.alreadyRated}</Text>
            </View>
          )}
          {order.status === 'CANCELLED' && (
            <View style={s.cancelledNote}>
              <XCircle size={14} color="#b91c1c" />
              <Text style={s.cancelledText}>Pasūtījums atcelts</Text>
            </View>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[s.cancelOrderBtn, actionLoading && { opacity: 0.5 }]}
              onPress={handleCancel}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <Text style={s.cancelOrderBtnText}>Atcelt pasūtījumu</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rating modal */}
      {id && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setAlreadyRated(true);
          }}
          token={token}
          orderId={id}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, marginHorizontal: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  driverCard: {
    backgroundColor: '#fff7f7',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  driverCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  driverName: { fontSize: 14, fontWeight: '600', color: '#dc2626', flex: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#374151' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#dc2626' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  rowValue: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' },
  callSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 12,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  callSiteBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actions: { gap: 10 },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ca8a04',
  },
  pendingText: { fontSize: 13, fontWeight: '600', color: '#a16207' },
  deliveredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
  },
  deliveredText: { fontSize: 13, fontWeight: '600', color: '#15803d' },
  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  cancelledText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  cancelOrderBtn: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#dc2626',
  },
  cancelOrderBtnText: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  alreadyRated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    padding: 12,
  },
  alreadyRatedText: { fontSize: 13, fontWeight: '600', color: '#a16207' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: '#6b7280' },
  trackingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff7f7',
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  trackingTitle: { fontSize: 12, fontWeight: '700', color: '#374151', flex: 1 },
  liveTag: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveTagText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});
