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
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/lib/haptics';
import { SELLER_ORDER_STATUS } from '@/lib/materials';
import { useToast } from '@/components/ui/Toast';
import { api, type ApiOrder } from '@/lib/api';
import { useLiveUpdates } from '@/lib/use-live-updates';
import {
  X,
  Square,
  CheckSquare2,
  MapPin,
  Inbox,
  AlertCircle,
  Clock,
  Phone,
  FileText,
} from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'LOADING' | 'DISPATCHED' | 'CANCELLED';
type FilterStatus = OrderStatus | 'ALL';

interface IncomingOrder {
  id: string;
  orderNumber: string;
  material: string;
  weightTonnes: number;
  truckCount?: number;
  buyerName: string;
  deliveryAddress: string;
  requestedDate: string;
  /** 'AM' | 'PM' | 'ANY' — preferred delivery slot */
  deliveryWindow?: string;
  /** Free-text buyer notes / site instructions */
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  price: number;
  status: OrderStatus;
  paymentStatus?: string;
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
    INVOICED: 'DISPATCHED',
    CANCELLED: 'CANCELLED',
    REJECTED: 'CANCELLED',
  };
  const item = o.items?.[0];
  const buyerName = o.buyer?.name ?? o.orderNumber;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    material: item?.material?.name ?? 'Materiāls',
    weightTonnes: item?.quantity ?? 0,
    buyerName,
    deliveryAddress: o.deliveryAddress ?? o.deliveryCity ?? '',
    requestedDate: o.deliveryDate
      ? new Date(o.deliveryDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
        })
      : new Date(o.createdAt).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
        }),
    price: o.total ?? 0,
    status: statusMap[o.status] ?? 'PENDING',
    paymentStatus: o.paymentStatus ?? undefined,
    transportJobId: (o as any).transportJobs?.[0]?.id,
    deliveryWindow: o.deliveryWindow ?? undefined,
    notes: o.notes ?? undefined,
    truckCount: (o as any).truckCount ?? undefined,
    siteContactName: o.siteContactName ?? undefined,
    siteContactPhone: o.siteContactPhone ?? undefined,
  };
}

// ── Status Helper ──────────────────────────────────────────────────────────────
function getMinimalStatus(status: OrderStatus) {
  switch (status) {
    case 'PENDING':
      return { text: 'Jauns', color: '#d97706', bg: '#fff7ed' };
    case 'CONFIRMED':
      return { text: 'Apstiprināts', color: '#2563eb', bg: '#eff6ff' };
    case 'LOADING':
      return { text: 'Iekraušana', color: '#16a34a', bg: '#f0fdf4' };
    case 'DISPATCHED':
      return { text: 'Piegādē', color: '#4b5563', bg: '#f3f4f6' };
    case 'CANCELLED':
      return { text: 'Atcelts', color: '#b91c1c', bg: '#fef2f2' };
    default:
      return { text: status, color: '#6b7280', bg: '#f3f4f6' };
  }
}

// ── LoadingDock — seller confirms driver has loaded ───────────────────────────
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
  const CHECKLIST = [
    'Auto atrodas pareizājā vietā',
    'Svars sakrīt ar pasūtījumu',
    'Materiāls ir pareizs',
    'Vadītājs ir klāt',
  ];
  const [weight, setWeight] = useState('');
  const [checkedItems, setCheckedItems] = useState<boolean[]>(CHECKLIST.map(() => false));

  useEffect(() => {
    if (visible) {
      setWeight('');
      setCheckedItems(CHECKLIST.map(() => false));
    }
  }, [visible]);

  const allChecked = checkedItems.every(Boolean);
  const toggleItem = (i: number) => {
    haptics.light();
    setCheckedItems((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <View style={modalStyles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <X size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={modalStyles.title}>Iekraušanas apstiprinājums</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={modalStyles.body}>
            <View style={modalStyles.heroCard}>
              <Text style={modalStyles.heroMaterial}>{order.material}</Text>
              <Text style={modalStyles.heroSub}>
                {order.buyerName} • #{order.orderNumber}
              </Text>
            </View>

            <View style={modalStyles.inputWrapper}>
              <Text style={modalStyles.inputLabel}>Faktiskais svars (tonnas)</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="Piem. 12.5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
            </View>

            <View style={modalStyles.checklist}>
              {CHECKLIST.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={modalStyles.checkRow}
                  onPress={() => toggleItem(i)}
                  activeOpacity={0.7}
                >
                  {checkedItems[i] ? (
                    <CheckSquare2 size={24} color="#111827" />
                  ) : (
                    <Square size={24} color="#d1d5db" />
                  )}
                  <Text
                    style={[modalStyles.checkText, checkedItems[i] && modalStyles.checkTextActive]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={modalStyles.footer}>
          <TouchableOpacity
            style={[
              modalStyles.confirmBtn,
              (!allChecked || confirming) && modalStyles.confirmBtnDisabled,
            ]}
            onPress={() => {
              haptics.success();
              const parsed = parseFloat(weight.replace(',', '.'));
              onConfirm(isNaN(parsed) ? undefined : parsed * 1000); // converting to kg if needed by API
            }}
            disabled={!allChecked || confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={modalStyles.confirmBtnText}>Apstiprināt un nosūtīt</Text>
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
  onPress,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  order: IncomingOrder;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onStartLoading: (id: string) => void;
  actioning: string | null;
  onPress: () => void;
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isBusy = actioning === order.id;
  const statusInfo = getMinimalStatus(order.status);
  const isBatchSelectable = batchMode && order.status === 'PENDING';

  return (
    <View style={[styles.card, isBatchSelectable && isSelected && styles.cardSelected]}>
      <TouchableOpacity
        onPress={isBatchSelectable ? () => onToggleSelect?.() : onPress}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.materialText}>
              {order.material} • {order.weightTonnes}t
            </Text>
            <Text style={styles.buyerText}>
              {order.buyerName} ({order.requestedDate})
            </Text>
          </View>
          <View style={styles.cardTopRight}>
            {isBatchSelectable ? (
              isSelected ? (
                <CheckSquare2 size={22} color="#111827" />
              ) : (
                <Square size={22} color="#d1d5db" />
              )
            ) : (
              <>
                <Text style={styles.priceText}>€{order.price.toFixed(0)}</Text>
                <StatusPill
                  label={statusInfo.text}
                  bg={statusInfo.bg}
                  color={statusInfo.color}
                  size="sm"
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.addressRow}>
          <MapPin size={14} color="#9ca3af" />
          <Text style={styles.addressText} numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>

        {/* Delivery window + site contact row */}
        {(order.deliveryWindow && order.deliveryWindow !== 'ANY') || order.siteContactName ? (
          <View style={styles.metaRow}>
            {order.deliveryWindow && order.deliveryWindow !== 'ANY' && (
              <View
                style={[styles.windowPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
              >
                <Clock size={11} color="#1d4ed8" />
                <Text style={styles.windowPillText}>
                  {order.deliveryWindow === 'AM' ? '8–12' : '12–17'}
                </Text>
              </View>
            )}
            {order.siteContactName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <Phone size={11} color="#6b7280" />
                <Text style={styles.siteContactText} numberOfLines={1}>
                  {order.siteContactName}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Buyer notes preview */}
        {order.notes ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 }}>
            <FileText size={11} color="#9ca3af" style={{ marginTop: 1 }} />
            <Text style={[styles.notesPreview, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
              {order.notes}
            </Text>
          </View>
        ) : null}

        {/* Payment status badge */}
        {order.paymentStatus && (
          <View style={{ marginTop: 6, marginBottom: 2 }}>
            <StatusPill
              label={
                order.paymentStatus === 'CAPTURED'
                  ? 'Maksājums saņemts'
                  : order.paymentStatus === 'AUTHORIZED'
                    ? 'Maksājums autorizēts'
                    : 'Gaida apmaksu'
              }
              bg={
                order.paymentStatus === 'AUTHORIZED' || order.paymentStatus === 'CAPTURED'
                  ? '#dcfce7'
                  : '#fff7ed'
              }
              color={
                order.paymentStatus === 'AUTHORIZED' || order.paymentStatus === 'CAPTURED'
                  ? '#16a34a'
                  : '#d97706'
              }
              size="sm"
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Actions — hidden in batch mode */}
      {!batchMode && order.status === 'PENDING' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnOutline, isBusy && styles.btnDisabled]}
            disabled={!!isBusy}
            onPress={() => onReject(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={styles.btnOutlineText}>Noraidīt</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSolid, isBusy && styles.btnDisabled]}
            disabled={!!isBusy}
            onPress={() => onConfirm(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.btnSolidText}>Apstiprināt</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!batchMode && order.status === 'CONFIRMED' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnPrimaryFlex, isBusy && styles.btnDisabled]}
            disabled={!!isBusy}
            onPress={() => onStartLoading(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.btnSolidText}>Sākt iekraušanu</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function IncomingScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState<IncomingOrder | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [confirmingLoad, setConfirmingLoad] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);

  const toggleBatchSelect = (id: string) =>
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBatchMode = () => {
    setBatchMode((b) => !b);
    setBatchSelectedIds(new Set());
  };

  const handleBatchConfirm = () => {
    const count = batchSelectedIds.size;
    if (count === 0) return;
    Alert.alert('Apstiprināt visus?', `Vai apstiprināt ${count} atlasītos pasūtījumus?`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: `Apstiprināt (${count})`,
        onPress: async () => {
          if (!token) return;
          setBatchConfirming(true);
          let succeeded = 0;
          for (const id of batchSelectedIds) {
            try {
              const updated = await api.orders.confirm(id, token);
              setOrders((prev) => prev.map((o) => (o.id === id ? mapApiOrder(updated) : o)));
              succeeded++;
            } catch {
              // continue
            }
          }
          haptics.success();
          toast.success(`${succeeded} pasūtījumi apstiprināti!`);
          setBatchMode(false);
          setBatchSelectedIds(new Set());
          setBatchConfirming(false);
        },
      },
    ]);
  };

  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setFetching(true);
      try {
        const data = await api.orders.myOrders(token);
        const companyId = user?.company?.id;
        const userId = user?.id;
        // Exclude self-orders: orders created by this user or placed by their own company.
        // A hybrid account (canSell + buyer) should not see their own purchases in the seller inbox.
        const sellerOrders = data.filter(
          (o) =>
            (companyId ? o.buyer?.id !== companyId : true) &&
            (userId ? o.createdBy?.id !== userId : true),
        );
        setOrders(sellerOrders.map(mapApiOrder));
      } catch (e) {
        if (!isRefresh) toast.error('Kļūda ielādējot pasūtījumus');
      } finally {
        setFetching(false);
        setRefreshing(false);
      }
    },
    [token, user?.company?.id],
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  // ── Live push: new orders from buyers arrive in real-time ─────────────────
  const { sellerNewOrder } = useLiveUpdates({
    sellerCompanyId: user?.company?.id ?? null,
    token,
  });
  useEffect(() => {
    if (sellerNewOrder) {
      fetchOrders(true);
    }
  }, [sellerNewOrder]);

  const handleConfirm = async (id: string) => {
    if (!token) return;
    setActioning(id);
    try {
      const updated = await api.orders.confirm(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? mapApiOrder(updated) : o)));
      haptics.success();
    } catch (e: unknown) {
      haptics.error();
      toast.error('Neizdevās apstiprināt pasūtījumu.');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = (id: string) => {
    Alert.alert('Noraidīt', 'Vai tiešām noraidīt šo pasūtījumu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Noraidīt',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setActioning(id);
          try {
            await api.orders.sellerCancel(id, 'Piegādātājs noraidīja pasūtījumu', token);
            setOrders((prev) => prev.filter((o) => o.id !== id));
            haptics.success();
          } catch (e: unknown) {
            haptics.error();
            toast.error('Neizdevās noraidīt pasūtījumu.');
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
        await api.transportJobs.loadingDock(loadingOrder.transportJobId, token, weightKg);
      } else {
        await api.orders.startLoading(loadingOrder.id, token, weightKg);
      }
      await fetchOrders(false);
      setLoadingOrder(null);
      haptics.success();
      toast.success('Iekraušana apstiprināta!');
    } catch (e: unknown) {
      haptics.error();
      toast.error('Neizdevās apstiprināt iekraušanu.');
    } finally {
      setConfirmingLoad(false);
    }
  };

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const visibleOrders =
    filterStatus === 'ALL' ? orders : orders.filter((o) => o.status === filterStatus);

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'ALL', label: 'Visi' },
    { key: 'PENDING', label: 'Jauni' },
    { key: 'CONFIRMED', label: 'Apstiprināti' },
    { key: 'LOADING', label: 'Iekraušana' },
    { key: 'DISPATCHED', label: 'Piegādē' },
    { key: 'CANCELLED', label: 'Atcelti' },
  ];

  if (fetching && !refreshing) {
    return (
      <ScreenContainer bg="white">
        <View style={{ padding: 24, gap: 16 }}>
          <SkeletonCard count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="white">
      {/* Batch select toggle — shown when there are PENDING orders */}
      {orders.some((o) => o.status === 'PENDING') && (
        <View
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, alignItems: 'flex-end' }}
        >
          <TouchableOpacity
            style={[styles.batchToggleBtn, batchMode && styles.batchToggleBtnActive]}
            onPress={toggleBatchMode}
            activeOpacity={0.8}
          >
            {batchMode ? (
              <X size={15} color="#6b7280" />
            ) : (
              <CheckSquare2 size={15} color="#374151" />
            )}
            <Text style={styles.batchToggleText}>{batchMode ? 'Atcelt' : 'Atlasīt'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs */}
      {orders.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {STATUS_FILTERS.map((f) => {
              const count =
                f.key === 'ALL' ? orders.length : orders.filter((o) => o.status === f.key).length;
              const active = filterStatus === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => {
                    haptics.light();
                    setFilterStatus(f.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                      <Text
                        style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          visibleOrders.length === 0 && { flexGrow: 1, justifyContent: 'center' },
        ]}
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
        {visibleOrders.length === 0 ? (
          <EmptyState
            icon={<Inbox size={32} color="#9ca3af" />}
            title={orders.length === 0 ? 'Nav pasūtījumu' : 'Nav atrasts'}
            subtitle={
              orders.length === 0
                ? 'Šobrīd nav neviena aktīva pasūtījuma.'
                : 'Šajā kategorijā pašlaik nav neviena pasūtījuma.'
            }
            action={
              orders.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => router.push('/(seller)/catalog' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyCtaText}>Pārbaudīt katalogu →</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        ) : (
          visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onStartLoading={handleStartLoading}
              actioning={actioning}
              onPress={() => router.push(`/(seller)/order/${order.id}` as any)}
              batchMode={batchMode}
              isSelected={batchSelectedIds.has(order.id)}
              onToggleSelect={() => toggleBatchSelect(order.id)}
            />
          ))
        )}
      </ScrollView>

      {batchMode && batchSelectedIds.size > 0 && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarText}>{batchSelectedIds.size} atlasīti</Text>
          <TouchableOpacity
            style={[styles.batchBarBtn, batchConfirming && { opacity: 0.6 }]}
            onPress={handleBatchConfirm}
            disabled={batchConfirming}
            activeOpacity={0.8}
          >
            {batchConfirming ? (
              <ActivityIndicator color="#111827" size="small" />
            ) : (
              <Text style={styles.batchBarBtnText}>Apstiprināt visus</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },

  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  filterPillActive: { backgroundColor: '#111827' },
  filterPillText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  filterPillTextActive: { color: '#ffffff' },
  filterBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  filterBadgeTextActive: { color: '#ffffff' },

  list: { padding: 16, paddingBottom: 40 },

  card: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTopLeft: { gap: 4, flex: 1, paddingRight: 10 },
  materialText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  buyerText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  cardTopRight: { alignItems: 'flex-end', gap: 4 },
  priceText: { fontSize: 18, fontWeight: '800', color: '#111827' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '600' },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  addressText: { fontSize: 14, color: '#4b5563', flex: 1, lineHeight: 20 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  windowPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  windowPillText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  siteContactText: { fontSize: 12, color: '#6b7280', flex: 1 },
  notesPreview: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  btnSolid: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSolidText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  btnPrimaryFlex: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    flex: 1, // Let it expand inside the flexGrow:1 ScrollView container
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },
  emptyCta: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },

  // Batch mode
  cardSelected: { backgroundColor: '#f0fdf4' },
  batchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  batchToggleBtnActive: { borderColor: '#9ca3af', backgroundColor: '#f3f4f6' },
  batchToggleText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  batchBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  batchBarText: { color: '#f9fafb', fontSize: 15, fontWeight: '600' },
  batchBarBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  batchBarBtnText: { color: '#111827', fontWeight: '700', fontSize: 14 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },

  body: { padding: 20, gap: 24 },

  heroCard: {
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 4,
  },
  heroMaterial: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: '#6b7280', fontWeight: '500' },

  inputWrapper: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  checklist: { gap: 16, marginTop: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkText: { fontSize: 16, color: '#6b7280', fontWeight: '500' },
  checkTextActive: { color: '#111827', fontWeight: '600' },

  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
  },
  confirmBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
