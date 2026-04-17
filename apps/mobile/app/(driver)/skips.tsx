/**
 * skips.tsx — Carrier: manage assigned skip-hire orders
 * Minimal, Uber-like Map-first interface.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  Trash2,
  MapPin,
  Phone,
  Calendar,
  Navigation2,
  CheckCircle2,
  Package,
  RefreshCw,
  List,
  Map as MapIcon,
  MapPinOff,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { api, SkipHireOrder, SkipHireStatus } from '@/lib/api';
import { BaseMap } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
let Marker: any = null;
try {
  Marker = require('react-native-maps').Marker;
} catch {
  /* Expo Go */
}
import { t } from '@/lib/translations';
import { formatDateNumeric } from '@/lib/format';
import { geocodeLocation } from '@/lib/maps';
import { colors } from '@/lib/theme';

const ACCENT = '#000000';
const RIGA: [number, number] = [24.1052, 56.9496];
const cs = t.carrierSkips;

function openMaps(address: string) {
  const enc = encodeURIComponent(address);
  const url = Platform.OS === 'ios' ? `maps:?q=${enc}` : `geo:0,0?q=${enc}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${enc}`));
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const result = await geocodeLocation(address);
  return result ? [result.lng, result.lat] : null;
}

function pinColor(status: string): string {
  if (status === 'CONFIRMED') return '#000000';
  if (status === 'DELIVERED') return '#374151';
  return '#9ca3af';
}

function OrderCard({
  order,
  onStatusUpdate,
  updating,
}: {
  order: SkipHireOrder;
  onStatusUpdate: (id: string, s: SkipHireStatus) => void;
  updating: boolean;
}) {
  const statusInfo = cs.status[order.status] ?? {
    label: order.status,
    bg: '#f3f4f6',
    color: colors.textSecondary,
  };
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
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.orderNumber}>#{order.orderNumber}</Text>
            <StatusPill
              label={statusInfo.label}
              bg={statusInfo.bg}
              color={statusInfo.color}
              size="sm"
            />
          </View>
          <Text style={s.addressText} numberOfLines={2}>
            {order.location}
          </Text>
        </View>
      </View>
      <View style={s.metaWrap}>
        <View style={s.metaItem}>
          <Package size={14} color="#6b7280" />
          <Text style={s.metaItemText}>{sizeLabel}</Text>
        </View>
        <View style={s.metaItem}>
          <Trash2 size={14} color="#6b7280" />
          <Text style={s.metaItemText}>{wasteLabel}</Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color="#6b7280" />
          <Text style={s.metaItemText}>{formatDateNumeric(order.deliveryDate)}</Text>
        </View>
      </View>
      {order.notes ? (
        <View style={s.notesBox}>
          <Text style={s.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => openMaps(order.location)}
          activeOpacity={0.8}
        >
          <Navigation2 size={16} color="#fff" />
          <Text style={s.navBtnText}>Rādīt ceļu</Text>
        </TouchableOpacity>
        {order.contactPhone && (
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(`tel:${order.contactPhone}`)}
            activeOpacity={0.8}
          >
            <Phone size={16} color="#000" />
          </TouchableOpacity>
        )}
      </View>
      {(canDeliver || canCollect) && (
        <TouchableOpacity
          style={[s.actionBtnPrimary, updating && { opacity: 0.5 }]}
          onPress={confirm}
          disabled={updating}
          activeOpacity={0.8}
        >
          {updating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.actionBtnPrimaryText}>
              {canDeliver ? 'Atzīmēt kā piegādātu' : 'Atzīmēt kā savāktu'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CarrierSkipsScreen() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});
  const [selectedOrder, setSelectedOrder] = useState<SkipHireOrder | null>(null);
  const [showList, setShowList] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const missing = orders.filter((o) => !coords[o.id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (o) => ({ id: o.id, coord: await geocodeAddress(o.location) })),
    ).then((results) => {
      const next = { ...coords };
      let added = false;
      results.forEach(({ id, coord }) => {
        if (coord) {
          next[id] = coord;
          added = true;
        }
      });
      if (added) {
        setCoords(next);
        const all = Object.values(next);
        if (all.length > 1 && cameraRef.current) {
          const lngs = all.map((c) => c[0]);
          const lats = all.map((c) => c[1]);
          setTimeout(() => {
            cameraRef.current?.fitBounds(
              [Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05],
              [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05],
              [100, 50, 100, 50],
              600,
            );
          }, 500);
        } else if (all.length === 1 && cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: all[0],
            zoomLevel: 13,
            animationDuration: 600,
          });
        }
      }
    });
  }, [orders]);

  const handleStatusUpdate = async (id: string, newStatus: SkipHireStatus) => {
    if (!token) return;
    setUpdatingId(id);
    try {
      const updated = await api.skipHire.updateCarrierStatus(id, newStatus, token);
      setOrders((prev) =>
        newStatus === 'COLLECTED'
          ? prev.filter((o) => o.id !== id)
          : prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)),
      );
      if (newStatus === 'COLLECTED') setSelectedOrder(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Neizdevās atjaunināt.')
    } finally {
      setUpdatingId(null);
    }
  };

  if (!user?.canSkipHire) {
    return (
      <ScreenContainer bg="#fff">
        <EmptyState
          icon={<Package size={42} color="#9ca3af" />}
          title="Nav pieejams"
          subtitle="Konteineru pārvaldība pieejama apstiprinātiem operatoriem."
        />
      </ScreenContainer>
    );
  }

  const toDeliver = orders.filter((o) => o.status === 'CONFIRMED');
  const toCollect = orders.filter((o) => o.status === 'DELIVERED');
  const resolved = orders.filter((o) => coords[o.id]);

  // No active skips — show empty state instead of an empty map
  if (!loading && orders.length === 0) {
    return (
      <ScreenContainer bg="#fff">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <MapPinOff size={48} color="#d1d5db" />
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: colors.textPrimary,
              marginTop: 20,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Nav aktīvu uzdevumu
          </Text>
          <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
            Visi konteineri ir piegādāti vai savākti.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 28,
              backgroundColor: colors.primary,
              paddingHorizontal: 28,
              paddingVertical: 14,
              borderRadius: 100,
            }}
            onPress={() => load()}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Atsvaidzināt</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <View style={s.root}>
      <BaseMap cameraRef={cameraRef} center={RIGA} zoom={10} style={StyleSheet.absoluteFillObject}>
        {resolved.map((order) => (
          <Marker
            key={order.id}
            coordinate={{ latitude: coords[order.id]![1], longitude: coords[order.id]![0] }}
            onPress={() => {
              setSelectedOrder(order);
              setShowList(false);
            }}
          >
            <View
              style={[
                s.mapPin,
                {
                  backgroundColor: pinColor(order.status),
                  transform: selectedOrder?.id === order.id ? [{ scale: 1.2 }] : [{ scale: 1 }],
                },
              ]}
            >
              <Trash2 size={16} color="#fff" />
            </View>
          </Marker>
        ))}
      </BaseMap>

      {/* Floating Header */}
      <View style={[s.floatingTop, { top: 12 }]}>
        <View style={s.pillHeader}>
          <Text style={s.pillText}>{orders.length} aktīvi uzdevumi</Text>
        </View>
      </View>

      {/* Floating Controls */}
      <View style={[s.floatingControls, { bottom: selectedOrder ? 400 : 100 }]}>
        <TouchableOpacity style={s.fab} onPress={() => load()} disabled={loading}>
          <RefreshCw size={22} color={loading ? '#9ca3af' : '#000'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.fab}
          onPress={() => {
            setShowList(true);
            setSelectedOrder(null);
          }}
        >
          <List size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Selected Order Bottom Sheet Overlay (Not full screen) */}
      {selectedOrder && !showList && (
        <View style={s.selectedOverlay} pointerEvents="box-none">
          <View style={s.selectedCardWrap}>
            <TouchableOpacity style={s.closeSelected} onPress={() => setSelectedOrder(null)}>
              <Text style={s.closeSelectedText}>Aizvērt</Text>
            </TouchableOpacity>
            <OrderCard
              order={selectedOrder}
              onStatusUpdate={handleStatusUpdate}
              updating={updatingId === selectedOrder.id}
            />
          </View>
        </View>
      )}

      {/* List View Bottom Sheet */}
      <BottomSheet
        visible={showList}
        onClose={() => setShowList(false)}
        title="Visi uzdevumi"
        scrollable
        maxHeightPct={0.85}
      >
        <View style={{ padding: 16 }}>
          {toDeliver.length > 0 && <Text style={s.listSectionTitle}>Jāpiegādā</Text>}
          {toDeliver.map((o) => (
            <View key={o.id} style={{ marginBottom: 16 }}>
              <OrderCard
                order={o}
                onStatusUpdate={handleStatusUpdate}
                updating={updatingId === o.id}
              />
            </View>
          ))}
          {toCollect.length > 0 && (
            <Text style={[s.listSectionTitle, toDeliver.length > 0 && { marginTop: 8 }]}>
              Jāsavāc
            </Text>
          )}
          {toCollect.map((o) => (
            <View key={o.id} style={{ marginBottom: 16 }}>
              <OrderCard
                order={o}
                onStatusUpdate={handleStatusUpdate}
                updating={updatingId === o.id}
              />
            </View>
          ))}
          {orders.length === 0 && (
            <Text style={{ textAlign: 'center', color: colors.textMuted, marginVertical: 32 }}>
              Nav aktīvu uzdevumu.
            </Text>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  floatingTop: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 10 },
  pillHeader: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  floatingControls: { position: 'absolute', right: 16, gap: 12, zIndex: 10 },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  mapPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  selectedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    zIndex: 20,
  },
  selectedCardWrap: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  closeSelected: { alignSelf: 'flex-end', marginBottom: 12 },
  closeSelectedText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { marginBottom: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderNumber: { fontSize: 16, fontWeight: '800', color: '#000' },
  addressText: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, fontWeight: '500' },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItemText: { fontSize: 13, color: '#4b5563', fontWeight: '600' },
  notesBox: {
    backgroundColor: '#fff8f1',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  notesText: { fontSize: 14, color: '#9a3412', fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  navBtn: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  navBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  callBtn: {
    width: 52,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  actionBtnPrimary: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listSectionTitle: { fontSize: 18, fontWeight: '800', color: '#000', marginBottom: 12 },
});
