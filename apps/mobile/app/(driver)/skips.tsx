/**
 * skips.tsx — Carrier: manage assigned skip-hire orders
 *
 * Shows all CONFIRMED + DELIVERED skip orders assigned to the carrier company.
 * Carrier can:
 *   • Navigate to the delivery address
 *   • Call the contact
 *   • Confirm delivery (CONFIRMED → DELIVERED)
 *   • Confirm collection (DELIVERED → COLLECTED)
 */

import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, SkipHireOrder, SkipHireStatus } from '@/lib/api';
import { t } from '@/lib/translations';

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT = '#dc2626'; // driver theme red
const ACCENT_LIGHT = '#fee2e2';
const ACCENT_DIM = '#991b1b';

const cs = t.carrierSkips;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  const url = Platform.OS === 'ios' ? `maps:?q=${encoded}` : `geo:0,0?q=${encoded}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com/?q=${encoded}`);
  });
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`);
}

// ── Skip Card ──────────────────────────────────────────────────────────────────

interface SkipCardProps {
  order: SkipHireOrder;
  onStatusUpdate: (id: string, newStatus: SkipHireStatus) => void;
  updating: boolean;
}

function SkipCard({ order, onStatusUpdate, updating }: SkipCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusInfo = cs.status[order.status] ?? {
    label: order.status,
    bg: '#f3f4f6',
    color: '#374151',
  };
  const sizeLabel = cs.sizes[order.skipSize] ?? order.skipSize;
  const wasteLabel = cs.wasteTypes[order.wasteCategory] ?? order.wasteCategory;

  const canDeliver = order.status === 'CONFIRMED';
  const canCollect = order.status === 'DELIVERED';

  const handleAction = () => {
    if (canDeliver) {
      Alert.alert(cs.confirmDelivery, cs.confirmDeliveryMsg, [
        { text: cs.cancel, style: 'cancel' },
        {
          text: cs.confirm,
          onPress: () => onStatusUpdate(order.id, 'DELIVERED'),
        },
      ]);
    } else if (canCollect) {
      Alert.alert(cs.confirmCollection, cs.confirmCollectionMsg, [
        { text: cs.cancel, style: 'cancel' },
        {
          text: cs.confirm,
          onPress: () => onStatusUpdate(order.id, 'COLLECTED'),
        },
      ]);
    }
  };

  return (
    <View style={styles.card}>
      {/* Card header — always visible */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.iconBox, { backgroundColor: statusInfo.bg }]}>
          <Trash2 size={22} color={statusInfo.color} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          {/* Top row: order number + status badge */}
          <View style={styles.titleRow}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.badgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Address */}
          <View style={styles.metaRow}>
            <MapPin size={13} color="#6b7280" />
            <Text style={styles.metaText} numberOfLines={1}>
              {order.location}
            </Text>
          </View>

          {/* Size + date */}
          <View style={styles.metaRow}>
            <Package size={13} color="#6b7280" />
            <Text style={styles.metaText}>{sizeLabel}</Text>
            <Calendar size={13} color="#6b7280" style={{ marginLeft: 10 }} />
            <Text style={styles.metaText}>{formatDate(order.deliveryDate)}</Text>
          </View>
        </View>

        {expanded ? (
          <ChevronUp size={18} color="#9ca3af" />
        ) : (
          <ChevronDown size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.divider} />

          {/* Detail rows */}
          <DetailRow
            icon={<Package size={14} color="#6b7280" />}
            label={cs.size}
            value={sizeLabel}
          />
          <DetailRow
            icon={<Trash2 size={14} color="#6b7280" />}
            label={cs.wasteType}
            value={wasteLabel}
          />
          <DetailRow
            icon={<MapPin size={14} color="#6b7280" />}
            label={cs.address}
            value={order.location}
          />
          <DetailRow
            icon={<Calendar size={14} color="#6b7280" />}
            label={cs.deliveryDate}
            value={formatDate(order.deliveryDate)}
          />
          {order.contactName && (
            <DetailRow
              icon={<Phone size={14} color="#6b7280" />}
              label={cs.client}
              value={order.contactName}
            />
          )}
          {order.contactPhone && (
            <DetailRow
              icon={<Phone size={14} color="#6b7280" />}
              label={cs.phone}
              value={order.contactPhone}
            />
          )}
          {order.notes ? (
            <View style={[styles.notesBox]}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {/* Navigate */}
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => openMaps(order.location)}
              activeOpacity={0.8}
            >
              <Navigation2 size={15} color={ACCENT} />
              <Text style={styles.navBtnText}>{cs.navigate}</Text>
            </TouchableOpacity>

            {/* Call */}
            {order.contactPhone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => callPhone(order.contactPhone!)}
                activeOpacity={0.8}
              >
                <Phone size={15} color="#374151" />
                <Text style={styles.callBtnText}>{cs.call}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Status action */}
          {(canDeliver || canCollect) && (
            <TouchableOpacity
              style={[styles.statusBtn, updating && { opacity: 0.5 }]}
              onPress={handleAction}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle2 size={17} color="#fff" />
                  <Text style={styles.statusBtnText}>
                    {canDeliver ? cs.markDelivered : cs.markCollected}
                  </Text>
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

// Small helper component
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      {icon}
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function CarrierSkipsScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.skipHire.carrierOrders(token);
        setOrders(data);
      } catch {
        // silent fail
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const handleStatusUpdate = useCallback(
    async (id: string, newStatus: SkipHireStatus) => {
      if (!token) return;
      setUpdatingId(id);
      try {
        const updated = await api.skipHire.updateCarrierStatus(id, newStatus, token);
        setOrders((prev) =>
          newStatus === 'COLLECTED'
            ? prev.filter((o) => o.id !== id) // remove from list once collected
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

  // Separate into two groups for visual clarity
  const toDeliver = orders.filter((o) => o.status === 'CONFIRMED');
  const toCollect = orders.filter((o) => o.status === 'DELIVERED');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{cs.title}</Text>
          <Text style={styles.headerSubtitle}>{cs.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => load()}
          style={styles.refreshIconBtn}
          hitSlop={8}
          disabled={loading}
        >
          <RefreshCw size={20} color={loading ? '#d1d5db' : ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Summary chips */}
      {!loading && orders.length > 0 && (
        <View style={styles.chipRow}>
          {toDeliver.length > 0 && (
            <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.chipText, { color: '#1d4ed8' }]}>
                {toDeliver.length} jāpiegādā
              </Text>
            </View>
          )}
          {toCollect.length > 0 && (
            <View style={[styles.chip, { backgroundColor: '#f3e8ff' }]}>
              <Text style={[styles.chipText, { color: '#7c3aed' }]}>
                {toCollect.length} jāsavāc
              </Text>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
        >
          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Trash2 size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{cs.empty}</Text>
              <Text style={styles.emptyDesc}>{cs.emptyDesc}</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => load()}>
                <RefreshCw size={15} color={ACCENT} />
                <Text style={[styles.refreshBtnText, { color: ACCENT }]}>{cs.refresh}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* To deliver */}
              {toDeliver.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Jāpiegādā ({toDeliver.length})</Text>
                  {toDeliver.map((o) => (
                    <SkipCard
                      key={o.id}
                      order={o}
                      onStatusUpdate={handleStatusUpdate}
                      updating={updatingId === o.id}
                    />
                  ))}
                </>
              )}

              {/* To collect */}
              {toCollect.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: toDeliver.length > 0 ? 16 : 0 }]}>
                    Jāsavāc ({toCollect.length})
                  </Text>
                  {toCollect.map((o) => (
                    <SkipCard
                      key={o.id}
                      order={o}
                      onStatusUpdate={handleStatusUpdate}
                      updating={updatingId === o.id}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingBottom: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 8 },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  refreshBtnText: { fontWeight: '600', fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: { fontSize: 13, color: '#6b7280', flexShrink: 1 },

  // ── Expanded ──────────────────────────────────────────────────
  expandedBody: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 10 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 7,
  },
  detailLabel: { fontSize: 13, color: '#6b7280', minWidth: 80 },
  detailValue: { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1 },
  notesBox: {
    backgroundColor: '#fef9c3',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  notesText: { fontSize: 13, color: '#713f12' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 9,
  },
  navBtnText: { color: ACCENT, fontWeight: '600', fontSize: 13 },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 9,
  },
  callBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 13,
  },
  statusBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
});
