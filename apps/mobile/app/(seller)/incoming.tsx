import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { api, type ApiOrder } from '@/lib/api';
import { Clock, CheckCircle2, Package, X, Square, MapPin, Check, Inbox } from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'LOADING' | 'DISPATCHED';
type FilterStatus = OrderStatus | 'ALL';

interface IncomingOrder {
  id: string;
  orderNumber: string;
  material: string;
  weightTonnes: number;
  buyerName: string;
  deliveryAddress: string;
  requestedDate: string;
  price: number;
  status: OrderStatus;
  transportJobId?: string;
}

// ── API mapper ────────────────────────────────────────────────────────────────
function mapApiOrder(o: ApiOrder): IncomingOrder {
  const statusMap: Record<string, OrderStatus> = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'CONFIRMED',
    IN_PROGRESS: 'LOADING',
    LOADING: 'LOADING',
    DELIVERING: 'DISPATCHED',
    DELIVERED: 'DISPATCHED',
    COMPLETED: 'DISPATCHED',
  };
  const item = o.items?.[0];
  const buyerName = o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}`.trim() : o.orderNumber;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    material: item?.material?.name ?? 'Unknown',
    weightTonnes: item?.quantity ?? 0,
    buyerName,
    deliveryAddress: o.deliveryAddress ?? o.deliveryCity ?? '',
    requestedDate: o.deliveryDate
      ? new Date(o.deliveryDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : new Date(o.createdAt).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
    price: o.total,
    status: statusMap[o.status] ?? 'PENDING',
    transportJobId: (o as any).transportJobs?.[0]?.id,
  };
}

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#f3f4f6', text: '#6b7280', label: 'Jauns' },
  CONFIRMED: { bg: '#f3f4f6', text: '#111827', label: 'Apstipārināts' },
  LOADING: { bg: '#f3f4f6', text: '#374151', label: 'Iekraušana' },
  DISPATCHED: { bg: '#dcfce7', text: '#111827', label: 'Nosūtīts' },
};

// ── LoadingDock — seller confirms driver has loaded ─────────────────────────────────
function LoadingModal({
  order,
  visible,
  onClose,
  onConfirm,
  confirming,
}: {
  order: IncomingOrder;
  visible: boolean;
  onClose: () => void;
  onConfirm: (weightKg?: number) => void;
  confirming?: boolean;
}) {
  const [weight, setWeight] = useState('');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={modalStyles.title}>{t.incoming.loading}</Text>
          <View style={{ width: 32 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={modalStyles.body}>
            {/* Order summary */}
            <View style={modalStyles.summaryCard}>
              <Text style={modalStyles.orderNum}>#{order.orderNumber}</Text>
              <Text style={modalStyles.materialText}>{order.material}</Text>
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryLabel}>Svars</Text>
                <Text style={modalStyles.summaryValue}>{order.weightTonnes}t</Text>
              </View>
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryLabel}>Pircējs</Text>
                <Text style={modalStyles.summaryValue}>{order.buyerName}</Text>
              </View>
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryLabel}>Adrese</Text>
                <Text style={modalStyles.summaryValue}>{order.deliveryAddress}</Text>
              </View>
              <View style={modalStyles.summaryRow}>
                <Text style={modalStyles.summaryLabel}>Datums</Text>
                <Text style={modalStyles.summaryValue}>{order.requestedDate}</Text>
              </View>
            </View>

            {/* Actual weight input */}
            <View style={modalStyles.weightCard}>
              <Text style={modalStyles.weightLabel}>Faktiskais svars (kg)</Text>
              <View style={modalStyles.weightInputRow}>
                <TextInput
                  style={modalStyles.weightInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder={`${order.weightTonnes * 1000}`}
                  placeholderTextColor="#9ca3af"
                />
                <Text style={modalStyles.weightUnit}>kg</Text>
              </View>
            </View>

            {/* Checklist */}
            <View style={modalStyles.checklistCard}>
              <Text style={modalStyles.checklistTitle}>Pirms iekraušanas pārbaudīt:</Text>
              {[
                'Kravas automašīna atrodas pareizajā vietā',
                'Svars sakrīt ar pasūtījumu',
                'Materiāls ir pareizs un kvalitatīvs',
                'Vadītājs ir klāt un gatavs',
              ].map((item, i) => (
                <View key={i} style={modalStyles.checkRow}>
                  <Square size={16} color="#9ca3af" />
                  <Text style={modalStyles.checkText}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Confirm button */}
        <View style={modalStyles.footer}>
          <Text style={modalStyles.footerDesc}>{t.incoming.loadingDesc}</Text>
          <TouchableOpacity
            style={[modalStyles.confirmBtn, confirming && { opacity: 0.6 }]}
            onPress={() => {
              const parsed = parseFloat(weight);
              onConfirm(isNaN(parsed) ? undefined : parsed);
            }}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={modalStyles.confirmBtnText}>{t.incoming.confirmLoad}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onConfirm,
  onReject,
  onStartLoading,
  actioning,
}: {
  order: IncomingOrder;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onStartLoading: (id: string) => void;
  actioning: string | null;
}) {
  const isBusy = actioning === order.id;
  const statusInfo = STATUS_COLORS[order.status];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
        </View>
      </View>

      {/* Material info */}
      <View style={styles.materialRow}>
        <Text style={styles.materialName}>{order.material}</Text>
        <Text style={styles.weightTag}>{order.weightTonnes}t</Text>
      </View>

      {/* Details */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Pircējs</Text>
          <Text style={styles.detailValue}>{order.buyerName}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Datums</Text>
          <Text style={styles.detailValue}>{order.requestedDate}</Text>
        </View>
        <View style={[styles.detailItem, { flex: 2 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <MapPin size={11} color="#9ca3af" />
            <Text style={styles.detailLabel}>Adrese</Text>
          </View>
          <Text style={styles.detailValue}>{order.deliveryAddress}</Text>
        </View>
      </View>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Summa</Text>
        <Text style={styles.priceValue}>€{order.price}</Text>
      </View>

      {/* Actions based on status */}
      {order.status === 'PENDING' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, isBusy && { opacity: 0.5 }]}
            onPress={() => onReject(order.id)}
            disabled={!!isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={styles.rejectBtnText}>{t.incoming.reject}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, isBusy && { opacity: 0.5 }]}
            onPress={() => onConfirm(order.id)}
            disabled={!!isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.confirmBtnText}>{t.incoming.confirm}</Text>
                <Check size={14} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {order.status === 'CONFIRMED' && (
        <TouchableOpacity
          style={[styles.loadingBtn, isBusy && { opacity: 0.5 }]}
          onPress={() => onStartLoading(order.id)}
          disabled={!!isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Package size={16} color="#ffffff" />
              <Text style={styles.loadingBtnText}>{t.incoming.confirmLoad}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function IncomingScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState<IncomingOrder | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [confirmingLoad, setConfirmingLoad] = useState(false);

  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setFetching(true);
      try {
        const data = await api.orders.myOrders(token);
        setOrders(data.map(mapApiOrder));
      } catch (e) {
        console.error('Failed to load orders', e);
        Alert.alert('Kļūda', 'Neizdevās ielādēt pasūtījumus.');
      } finally {
        setFetching(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleConfirm = async (id: string) => {
    if (!token) return;
    setActioning(id);
    try {
      const updated = await api.orders.confirm(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? mapApiOrder(updated) : o)));
      haptics.success();
    } catch (e: any) {
      haptics.error();
      toast.error(e.message ?? 'Neizdevās apstiprināt pasūtījumu.');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = (id: string) => {
    Alert.alert(t.incoming.reject, 'Vai tiešām noraidīt šo pasūtījumu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Noraidīt',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setActioning(id);
          try {
            await api.orders.cancel(id, token);
            setOrders((prev) => prev.filter((o) => o.id !== id));
            haptics.success();
          } catch (e: any) {
            haptics.error();
            toast.error(e.message ?? 'Neizdevās noraidīt pasūtījumu.');
          } finally {
            setActioning(null);
          }
        },
      },
    ]);
  };

  const handleStartLoading = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order) setLoadingOrder(order);
  };

  const handleConfirmLoad = async (weightKg?: number) => {
    if (!loadingOrder || !token) return;
    setConfirmingLoad(true);
    try {
      if (loadingOrder.transportJobId) {
        // LoadingDock: seller confirms driver loaded via transport-job endpoint
        await api.transportJobs.loadingDock(loadingOrder.transportJobId, token, weightKg);
      } else {
        // Fallback: order-level start-loading (no transport job linked yet)
        await api.orders.startLoading(loadingOrder.id, token);
      }
      await fetchOrders(false);
      setLoadingOrder(null);
      haptics.success();
      toast.success('Iekraušana apstiprināta — transporta darbs sākts!');
    } catch (e: any) {
      haptics.error();
      toast.error(e.message ?? 'Neizdevās apstiprināt iekraušanu.');
    } finally {
      setConfirmingLoad(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const visibleOrders =
    filterStatus === 'ALL' ? orders : orders.filter((o) => o.status === filterStatus);

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'ALL', label: 'Visi' },
    { key: 'PENDING', label: 'Jauni' },
    { key: 'CONFIRMED', label: 'Apstiprināti' },
    { key: 'LOADING', label: 'Iekraušana' },
    { key: 'DISPATCHED', label: 'Nosūtīti' },
  ];

  if (fetching) {
    return (
      <ScreenContainer bg="#f9fafb">
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.incoming.title}</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>
              {pendingCount} jaun{pendingCount === 1 ? 's' : 'i'}
            </Text>
          </View>
        )}
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((f) => {
          const count =
            f.key === 'ALL' ? orders.length : orders.filter((o) => o.status === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filterStatus === f.key && styles.filterChipActive]}
              onPress={() => setFilterStatus(f.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.filterChipCount,
                    filterStatus === f.key && styles.filterChipCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipCountText,
                      filterStatus === f.key && styles.filterChipCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Inbox size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t.incoming.empty}</Text>
          <Text style={styles.emptyDesc}>{t.incoming.emptyDesc}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchOrders(true);
              }}
              tintColor="#111827"
            />
          }
        >
          {visibleOrders.length === 0 && (
            <View style={styles.empty}>
              <Inbox size={36} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Nav pasūtījumu</Text>
              <Text style={styles.emptyDesc}>Šajā kategorijā nav pasūtījumu</Text>
            </View>
          )}
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onStartLoading={handleStartLoading}
              actioning={actioning}
            />
          ))}
        </ScrollView>
      )}

      {/* Loading modal */}
      {loadingOrder && (
        <LoadingModal
          order={loadingOrder}
          visible={!!loadingOrder}
          onClose={() => !confirmingLoad && setLoadingOrder(null)}
          onConfirm={handleConfirmLoad}
          confirming={confirmingLoad}
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827', flex: 1 },
  pendingBadge: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'flex-start',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#fff' },
  filterChipCount: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterChipCountText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  filterChipCountTextActive: { color: '#fff' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  materialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialName: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  weightTag: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { flex: 1, minWidth: '40%' },
  detailLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceLabel: { fontSize: 13, color: '#6b7280' },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#111827' },

  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    alignItems: 'center',
  },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  loadingBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  loadingBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: { fontSize: 18, color: '#6b7280', fontWeight: '600', padding: 6 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },

  body: { padding: 20, gap: 16 },

  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderNum: { fontSize: 12, color: '#9ca3af', fontWeight: '600', letterSpacing: 0.5 },
  materialText: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#111827' },

  weightCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  weightLabel: { fontSize: 13, fontWeight: '600', color: '#9a3412' },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  weightUnit: { fontSize: 16, fontWeight: '700', color: '#9a3412', width: 30 },

  checklistCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  checklistTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkIcon: { fontSize: 18, color: '#9ca3af' },
  checkText: { fontSize: 14, color: '#374151', flex: 1 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 10,
  },
  footerDesc: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#374151',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});
