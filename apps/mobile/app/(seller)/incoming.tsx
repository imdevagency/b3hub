import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { api, type ApiOrder, type OpenQuoteRequest } from '@/lib/api';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { colors } from '@/lib/theme';
import {
  X,
  Square,
  CheckSquare2,
  MapPin,
  Inbox,
  Clock,
  Phone,
  FileText,
  Package,
  Send,
  AlertTriangle,
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
  deliveryWindow?: string;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  price: number;
  status: OrderStatus;
  paymentStatus?: string;
  transportJobId?: string;
}

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
      ? new Date(o.deliveryDate).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' })
      : new Date(o.createdAt).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
    price: o.total ?? 0,
    status: statusMap[o.status] ?? 'PENDING',
    paymentStatus: o.paymentStatus ?? undefined,
    transportJobId: o.transportJobs?.[0]?.id,
    deliveryWindow: o.deliveryWindow ?? undefined,
    notes: o.notes ?? undefined,
    truckCount: o.truckCount ?? undefined,
    siteContactName: o.siteContactName ?? undefined,
    siteContactPhone: o.siteContactPhone ?? undefined,
  };
}

function getStatusMeta(status: OrderStatus) {
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
      return { text: 'Atcelts', color: colors.dangerText, bg: '#fef2f2' };
    default:
      return { text: status, color: colors.textMuted, bg: '#f3f4f6' };
  }
}

// ── LoadingModal ──────────────────────────────────────────────────────────────
const CHECKLIST = [
  'Auto atrodas pareizājā vietā',
  'Svars sakrīt ar pasūtījumu',
  'Materiāls ir pareizs',
  'Vadītājs ir klāt',
];

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
  const [checkedItems, setCheckedItems] = useState<boolean[]>(CHECKLIST.map(() => false));

  useEffect(() => {
    if (visible) {
      setWeight('');
      setCheckedItems(CHECKLIST.map(() => false));
    }
  }, [visible]);

  const allChecked = checkedItems.every(Boolean);
  const toggle = (i: number) => {
    haptics.light();
    setCheckedItems((p) => p.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Iekraušanas apstiprinājums" scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: 20, gap: 24 }}>
          <View className="pb-6 border-b border-gray-100">
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              {order.material}
            </Text>
            <Text className="text-gray-500 font-medium mt-1" style={{ fontSize: 15 }}>
              {order.buyerName} · #{order.orderNumber}
            </Text>
          </View>

          <View>
            <Text className="text-gray-900 font-bold text-sm mb-2">Faktiskais svars (tonnas)</Text>
            <TextInput
              className="bg-gray-100 rounded-2xl px-4 text-gray-900 font-bold"
              style={{ paddingVertical: 16, fontSize: 22 }}
              placeholder="Piem. 12.5"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>

          <View style={{ gap: 16 }}>
            {CHECKLIST.map((item, i) => (
              <TouchableOpacity
                key={i}
                className="flex-row items-center"
                style={{ gap: 12 }}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
              >
                {checkedItems[i] ? (
                  <CheckSquare2 size={26} color="#111827" />
                ) : (
                  <Square size={26} color="#d1d5db" />
                )}
                <Text
                  style={{
                    fontSize: 16,
                    color: checkedItems[i] ? '#111827' : '#6b7280',
                    fontWeight: checkedItems[i] ? '600' : '400',
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            className={`rounded-full items-center justify-center py-5 ${allChecked && !confirming ? 'bg-gray-900' : 'bg-gray-200'}`}
            onPress={() => {
              haptics.success();
              const parsed = parseFloat(weight.replace(',', '.'));
              onConfirm(isNaN(parsed) ? undefined : parsed * 1000);
            }}
            disabled={!allChecked || confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text
                style={{
                  color: allChecked ? '#ffffff' : '#9ca3af',
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                Apstiprināt un nosūtīt
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onConfirm,
  onReject,
  onStartLoading,
  actioning,
  onPress,
}: {
  order: IncomingOrder;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onStartLoading: (id: string) => void;
  actioning: string | null;
  onPress: () => void;
}) {
  const isBusy = actioning === order.id;
  const statusMeta = getStatusMeta(order.status);

  return (
    <View className="px-5 pt-5 border-b border-gray-100 bg-white">
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {/* Top row: material + price */}
        <View className="flex-row justify-between items-start mb-1">
          <View className="flex-1 pr-4">
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.3,
              }}
            >
              {order.material}
            </Text>
            <Text className="text-gray-500 font-medium text-sm mt-0.5">
              {order.weightTonnes}t · {order.buyerName} · {order.requestedDate}
            </Text>
          </View>
          <View className="items-end" style={{ gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
              €{order.price.toFixed(0)}
            </Text>
            <StatusPill
              label={statusMeta.text}
              bg={statusMeta.bg}
              color={statusMeta.color}
              size="sm"
            />
          </View>
        </View>

        {/* Address row */}
        <View className="flex-row items-center mt-2" style={{ gap: 5 }}>
          <MapPin size={13} color="#9ca3af" />
          <Text className="text-gray-500 text-sm flex-1" numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>

        {/* Delivery window + site contact */}
        {((order.deliveryWindow && order.deliveryWindow !== 'ANY') || order.siteContactName) && (
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            {order.deliveryWindow && order.deliveryWindow !== 'ANY' && (
              <View
                className="bg-blue-50 flex-row items-center px-2 py-1 rounded-lg"
                style={{ gap: 4 }}
              >
                <Clock size={11} color="#1d4ed8" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1d4ed8' }}>
                  {order.deliveryWindow === 'AM' ? '8–12' : '12–17'}
                </Text>
              </View>
            )}
            {order.siteContactName && (
              <View className="flex-row items-center flex-1" style={{ gap: 4 }}>
                <Phone size={11} color="#9ca3af" />
                <Text className="text-gray-500 " style={{ fontSize: 13 }} numberOfLines={1}>
                  {order.siteContactName}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Notes */}
        {order.notes && (
          <View className="flex-row items-start mt-1.5" style={{ gap: 4 }}>
            <FileText size={11} color="#9ca3af" style={{ marginTop: 1 }} />
            <Text
              className="text-gray-400 flex-1"
              style={{ fontSize: 13, fontStyle: 'italic' }}
              numberOfLines={1}
            >
              {order.notes}
            </Text>
          </View>
        )}

        {/* Payment status */}
        {order.paymentStatus && (
          <View className="mt-2.5 mb-1">
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

      {/* Actions */}
      {order.status === 'PENDING' && (
        <View className="flex-row mt-4 mb-4" style={{ gap: 10 }}>
          <TouchableOpacity
            className={`flex-1 items-center justify-center rounded-full py-3.5 bg-gray-100 ${isBusy ? 'opacity-50' : ''}`}
            disabled={!!isBusy}
            onPress={() => onReject(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                Noraidīt
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-2 items-center justify-center rounded-full py-3.5 bg-gray-900 ${isBusy ? 'opacity-50' : ''}`}
            style={{ flex: 2 }}
            disabled={!!isBusy}
            onPress={() => onConfirm(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.white }}>
                Apstiprināt
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {order.status === 'CONFIRMED' && (
        <View className="mt-4 mb-4">
          <TouchableOpacity
            className={`items-center justify-center rounded-full py-3.5 bg-gray-900 ${isBusy ? 'opacity-50' : ''}`}
            disabled={!!isBusy}
            onPress={() => onStartLoading(order.id)}
            activeOpacity={0.7}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.white }}>
                Sākt iekraušanu
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* No-action spacer for other statuses */}
      {order.status !== 'PENDING' && order.status !== 'CONFIRMED' && <View className="mb-4" />}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function IncomingScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [section, setSection] = useState<'orders' | 'quotes'>('orders');
  const [quoteRequests, setQuoteRequests] = useState<OpenQuoteRequest[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState<IncomingOrder | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [confirmingLoad, setConfirmingLoad] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  // Reject confirmation bottom sheet
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (!isRefresh) setFetching(true);
      try {
        const data = await api.orders.myOrders(token);
        const companyId = user?.company?.id;
        const userId = user?.id;
        const sellerOrders = data.filter(
          (o) =>
            (companyId ? o.buyer?.id !== companyId : true) &&
            (userId ? o.createdBy?.id !== userId : true),
        );
        setOrders(sellerOrders.map(mapApiOrder));
      } catch {
        if (!isRefresh) toast.error('Kļūda ielādējot pasūtījumus');
      } finally {
        setFetching(false);
        setRefreshing(false);
      }
    },
    [token, user?.company?.id],
  );

  const fetchQuotes = useCallback(async () => {
    if (!token) return;
    setQuotesLoading(true);
    try {
      const data = await api.quoteRequests.openRequests(token);
      setQuoteRequests(data);
    } catch {
    } finally {
      setQuotesLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      fetchQuotes();
    }, [fetchOrders, fetchQuotes]),
  );

  const { sellerNewOrder } = useLiveUpdates({ sellerCompanyId: user?.company?.id ?? null, token });
  useEffect(() => {
    if (sellerNewOrder) fetchOrders(true);
  }, [sellerNewOrder, fetchOrders]);

  const handleConfirm = async (id: string) => {
    if (!token) return;
    setActioning(id);
    try {
      const updated = await api.orders.confirm(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? mapApiOrder(updated) : o)));
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās apstiprināt pasūtījumu.');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = (id: string) => {
    haptics.warning();
    setRejectTarget(id);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !token) return;
    const id = rejectTarget;
    setRejectTarget(null);
    setActioning(id);
    try {
      await api.orders.sellerCancel(id, 'Piegādātājs noraidīja pasūtījumu', token);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      haptics.success();
    } catch {
      haptics.error();
      toast.error('Neizdevās noraidīt pasūtījumu.');
    } finally {
      setActioning(null);
    }
  };

  const handleStartLoading = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order) setLoadingOrder(order);
  };

  const handleConfirmLoad = async (weightKg?: number) => {
    if (!loadingOrder || !token) return;
    setConfirmingLoad(true);
    try {
      if (loadingOrder.transportJobId)
        await api.transportJobs.loadingDock(loadingOrder.transportJobId, token, weightKg);
      else await api.orders.startLoading(loadingOrder.id, token, weightKg);
      await fetchOrders(false);
      setLoadingOrder(null);
      haptics.success();
      toast.success('Iekraušana apstiprināta!');
    } catch {
      haptics.error();
      toast.error('Neizdevās apstiprināt iekraušanu.');
    } finally {
      setConfirmingLoad(false);
    }
  };

  const visibleOrders = useMemo(
    () => (filterStatus === 'ALL' ? orders : orders.filter((o) => o.status === filterStatus)),
    [filterStatus, orders],
  );

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'ALL', label: 'Visi' },
    { key: 'PENDING', label: 'Jauni' },
    { key: 'CONFIRMED', label: 'Apstiprināti' },
    { key: 'LOADING', label: 'Iekraušana' },
    { key: 'DISPATCHED', label: 'Piegādē' },
    { key: 'CANCELLED', label: 'Atcelti' },
  ];

  const renderOrderItem = useCallback(
    ({ item: order }: { item: IncomingOrder }) => (
      <OrderCard
        order={order}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onStartLoading={handleStartLoading}
        actioning={actioning}
        onPress={() => router.push(`/(seller)/order/${order.id}`)}
      />
    ),
    [handleConfirm, handleReject, handleStartLoading, actioning, router],
  );

  if (fetching && !refreshing) {
    return (
      <ScreenContainer bg="#ffffff">
        <View style={{ padding: 24, gap: 16 }}>
          <SkeletonCard count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      {/* ── Header ── */}
      <View className="px-5 pt-6 pb-2">
        <Text
          style={{
            fontSize: 32,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.8,
            lineHeight: 38,
          }}
        >
          Ienākošie
        </Text>
      </View>

      {/* ── Segment control ── */}
      <View className="px-5 mt-2 mb-4">
        <View className="flex-row bg-gray-100 p-1 rounded-2xl">
          {(
            [
              {
                key: 'orders',
                label: `Pasūtījumi${orders.length > 0 ? ` · ${orders.length}` : ''}`,
              },
              {
                key: 'quotes',
                label: `Cenas${quoteRequests.length > 0 ? ` · ${quoteRequests.length}` : ''}`,
                dot: quoteRequests.length > 0,
              },
            ] as const
          ).map((s) => {
            const active = section === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${active ? 'bg-white' : ''}`}
                style={
                  active
                    ? {
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 1,
                        shadowOffset: { width: 0, height: 1 },
                      }
                    : {}
                }
                onPress={() => {
                  haptics.light();
                  setSection(s.key);
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: active ? '#111827' : '#6b7280' }}
                >
                  {s.label}
                </Text>
                {'dot' in s && s.dot && !active && (
                  <View className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Quotes section ── */}
      {section === 'quotes' && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={quotesLoading}
              onRefresh={fetchQuotes}
              tintColor="#111827"
            />
          }
        >
          {quotesLoading && quoteRequests.length === 0 ? (
            <View className="px-5 pt-2">
              <SkeletonCard count={3} />
            </View>
          ) : quoteRequests.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} color="#9ca3af" />}
              title="Nav cenu pieprasījumu"
              subtitle="Jauni pieprasījumi parādīsies šeit."
            />
          ) : (
            quoteRequests.map((req) => (
              <TouchableOpacity
                key={req.id}
                className="flex-row items-center px-5 py-4 border-b border-gray-100 bg-white"
                style={{ gap: 12 }}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.light();
                  router.push({
                    pathname: '/(seller)/quotes',
                    params: { highlight: req.id },
                  } as any);
                }}
              >
                <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center">
                  <Package size={18} color="#2563eb" />
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                    {req.materialCategory}
                  </Text>
                  <Text className="text-gray-500 font-medium mt-0.5" style={{ fontSize: 13 }}>
                    {req.quantity} {req.unit} · {req.deliveryCity}
                  </Text>
                </View>
                <View
                  className="flex-row items-center bg-blue-600 px-3 py-2 rounded-full"
                  style={{ gap: 5 }}
                >
                  <Send size={12} color="#fff" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Atbildēt</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Orders section ── */}
      {section === 'orders' && (
        <>
          {orders.length > 0 && (
            <View className="mb-3">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              >
                {STATUS_FILTERS.map((f) => {
                  const count =
                    f.key === 'ALL'
                      ? orders.length
                      : orders.filter((o) => o.status === f.key).length;
                  const active = filterStatus === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      className={`flex-row items-center px-4 py-2 rounded-full ${active ? 'bg-gray-900' : 'bg-gray-100'}`}
                      style={{ gap: 6 }}
                      onPress={() => {
                        haptics.light();
                        setFilterStatus(f.key);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: active ? '#fff' : '#374151',
                        }}
                      >
                        {f.label}
                      </Text>
                      {count > 0 && (
                        <View
                          className={`px-1.5 py-0.5 rounded-full items-center justify-center ${active ? 'bg-gray-700' : 'bg-gray-200'}`}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: active ? '#fff' : '#374151',
                            }}
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

          <FlatList
            data={visibleOrders}
            keyExtractor={(item) => item.id}
            removeClippedSubviews={true}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            renderItem={renderOrderItem}
            contentContainerStyle={
              visibleOrders.length === 0 ? { flexGrow: 1 } : { paddingBottom: 60 }
            }
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
            ListEmptyComponent={
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
                      className="mt-3 bg-gray-900 rounded-full px-6 py-3"
                      onPress={() => router.push('/(seller)/catalog')}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                        Pārbaudīt katalogu →
                      </Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            }
          />
        </>
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

      {/* Reject confirmation sheet */}
      <BottomSheet
        visible={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Noraidīt pasūtījumu?"
      >
        <View style={{ padding: 20, gap: 16 }}>
          <View className="flex-row items-center gap-3 bg-red-50 rounded-2xl p-4">
            <AlertTriangle size={22} color="#dc2626" />
            <Text className="text-red-700 font-medium flex-1" style={{ fontSize: 14 }}>
              Pasūtītājs tiks informēts, ka jūs nevarat izpildīt šo pasūtījumu.
            </Text>
          </View>

          <TouchableOpacity
            className="bg-red-600 rounded-full items-center justify-center py-4"
            onPress={handleRejectConfirm}
          >
            <Text className="text-white font-bold" style={{ fontSize: 16 }}>
              Noraidīt pasūtījumu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center py-3"
            onPress={() => setRejectTarget(null)}
          >
            <Text className="text-gray-500 font-medium" style={{ fontSize: 15 }}>
              Atcelt
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}
