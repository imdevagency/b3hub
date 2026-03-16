import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { t } from '@/lib/translations';
import type { SkipHireOrder, ApiOrder, ApiTransportJob } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import {
  MapPin,
  CalendarDays,
  Trash2,
  Package,
  Truck,
  Recycle,
  Phone,
  User,
  Star,
  Plus,
  ChevronRight,
} from 'lucide-react-native';
import { RatingModal } from '@/components/ui/RatingModal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UNIT_SHORT, MAT_STATUS, TJB_STATUS } from '@/lib/materials';

// ── Types ─────────────────────────────────────────────────────

type FilterKey = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

type UnifiedOrder =
  | { kind: 'skip'; data: SkipHireOrder; sortDate: number; isActive: boolean }
  | { kind: 'material'; data: ApiOrder; sortDate: number; isActive: boolean }
  | { kind: 'transport'; data: ApiTransportJob; sortDate: number; isActive: boolean };

// ── Constants ─────────────────────────────────────────────────

const SKIP_ACTIVE = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);
const SKIP_DONE = new Set(['COLLECTED', 'COMPLETED']);
const MAT_ACTIVE = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED']);

const SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini · 2 m³',
  MIDI: 'Midi · 4 m³',
  BUILDERS: 'Celtniec. · 6 m³',
  LARGE: 'Liels · 8 m³',
};

const VEHICLE_LABEL: Record<string, string> = {
  TIPPER_SMALL: 'Pašizgāzējs 10 t',
  TIPPER_LARGE: 'Pašizgāzējs 18 t',
  ARTICULATED_TIPPER: 'Sattelkipper 26 t',
};

const CARGO_LABEL: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti atkritumi',
  HAZARDOUS: 'Bīstami atkritumi',
  SAND: 'Smiltis',
  GRAVEL: 'Grants / Šķembas',
  STONE: 'Akmens',
  MATERIALS: 'Celtniecības materiāli',
};

// UNIT_SHORT, MAT_STATUS, TJB_STATUS — imported from @/lib/materials

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'ACTIVE', label: 'Aktīvie' },
  { key: 'DONE', label: 'Pabeigti' },
  { key: 'CANCELLED', label: 'Atcelti' },
];

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

function skipBucket(status: string): FilterKey {
  if (SKIP_ACTIVE.has(status)) return 'ACTIVE';
  if (SKIP_DONE.has(status)) return 'DONE';
  return 'CANCELLED';
}

function matBucket(status: string): FilterKey {
  if (MAT_ACTIVE.has(status)) return 'ACTIVE';
  if (status === 'DELIVERED') return 'DONE';
  return 'CANCELLED';
}

const TJB_ACTIVE = new Set([
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);
function reqBucket(status: string): FilterKey {
  if (TJB_ACTIVE.has(status)) return 'ACTIVE';
  if (status === 'DELIVERED') return 'DONE';
  return 'CANCELLED';
}

// ── Unified card ──────────────────────────────────────────────

function AnimatedCardWrapper({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const delay = Animated.delay(Math.min(index, 6) * 55);
    Animated.sequence([
      delay,
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 72, friction: 11 }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 72,
          friction: 11,
        }),
      ]),
    ]).start();
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function UnifiedCard({ item, onRate }: { item: UnifiedOrder; onRate?: () => void }) {
  const router = useRouter();

  if (item.kind === 'skip') {
    const order = item.data;
    const status = t.skipHire.status[order.status] ?? t.skipHire.status.PENDING;
    const canRate = order.status === 'COLLECTED' || order.status === 'COMPLETED';

    return (
      <TouchableOpacity
        style={[s.card, item.isActive && s.cardActive]}
        onPress={() => {
          haptics.light();
          router.push(`/(buyer)/skip-order/${order.id}` as any);
        }}
        activeOpacity={0.88}
      >
        {item.isActive && <View style={s.activeStrip} />}
        <View style={s.cardInner}>
          <View style={s.cardTop}>
            <View style={s.typeTag}>
              <Trash2 size={11} color="#6b7280" />
              <Text style={s.typeTagText}>Konteiners</Text>
            </View>
            <View style={[s.badge, { backgroundColor: status.bg }]}>
              <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
          <Text style={s.orderSub}>{SIZE_LABEL[order.skipSize] ?? order.skipSize}</Text>
          <View style={s.metaRow}>
            <MapPin size={13} color="#6b7280" />
            <Text style={s.metaText} numberOfLines={1}>
              {order.location}
            </Text>
          </View>
          <View style={s.metaRow}>
            <CalendarDays size={13} color="#6b7280" />
            <Text style={s.metaText}>{formatDate(order.deliveryDate)}</Text>
          </View>
          <View style={s.cardFooter}>
            <Text style={s.price}>€{order.price}</Text>
            {canRate && onRate ? (
              <TouchableOpacity style={s.actionChip} onPress={onRate} activeOpacity={0.8}>
                <Star size={12} color="#6b7280" fill="#6b7280" />
                <Text style={s.actionChipText}>Vērtēt</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Transport request (disposal / freight)
  if (item.kind === 'transport') {
    return <TransportRequestCard item={item} />;
  }

  // Material order
  const order = item.data;
  const st = MAT_STATUS[order.status] ?? MAT_STATUS.PENDING;
  const first = order.items[0];
  const extra = order.items.length - 1;
  const activeJob = order.transportJobs?.find(
    (j) =>
      j.status === 'EN_ROUTE_DELIVERY' ||
      j.status === 'AT_DELIVERY' ||
      j.status === 'LOADED' ||
      j.status === 'EN_ROUTE_PICKUP' ||
      j.status === 'AT_PICKUP' ||
      j.status === 'ACCEPTED',
  );
  const driver = activeJob?.driver;

  return (
    <TouchableOpacity
      style={[s.card, item.isActive && s.cardActive]}
      onPress={() => {
        haptics.light();
        router.push(`/(buyer)/order/${order.id}`);
      }}
      activeOpacity={0.88}
    >
      {item.isActive && <View style={s.activeStrip} />}
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <Truck size={11} color="#6b7280" />
            <Text style={s.typeTagText}>Materiāli</Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={s.orderNum}>{order.orderNumber}</Text>
        <Text style={s.orderSub} numberOfLines={1}>
          {first
            ? `${first.material.name}${extra > 0 ? ` +${extra}` : ''}`
            : 'Materiālu pasūtījums'}
        </Text>
        {driver && order.status === 'SHIPPED' && (
          <View style={s.driverRow}>
            <User size={13} color="#111827" />
            <Text style={s.driverName} numberOfLines={1}>
              {driver.firstName} {driver.lastName}
            </Text>
            {driver.phone ? (
              <TouchableOpacity
                style={s.callChip}
                onPress={() =>
                  Linking.openURL(`tel:${driver.phone}`).catch(() =>
                    Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                  )
                }
              >
                <Phone size={12} color="#fff" />
                <Text style={s.callText}>Zvanīt</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {order.deliveryAddress ? (
          <View style={s.metaRow}>
            <MapPin size={13} color="#6b7280" />
            <Text style={s.metaText} numberOfLines={1}>
              {order.deliveryAddress}
              {order.deliveryCity ? `, ${order.deliveryCity}` : ''}
            </Text>
          </View>
        ) : null}
        {order.deliveryDate ? (
          <View style={s.metaRow}>
            <CalendarDays size={13} color="#6b7280" />
            <Text style={s.metaText}>{formatDate(order.deliveryDate)}</Text>
          </View>
        ) : null}
        {first && (
          <View style={s.matRow}>
            <Text style={s.matDetail}>
              {first.quantity} {UNIT_SHORT[first.unit] ?? first.unit} · {first.material.name}
            </Text>
            <Text style={s.matPrice}>€{first.total.toFixed(2)}</Text>
          </View>
        )}
        <View style={s.cardFooter}>
          <Text style={s.price}>€{order.total.toFixed(2)}</Text>
          <ChevronRight size={16} color="#9ca3af" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Transport request card (disposal / freight) ───────────────

function TransportRequestCard({ item }: { item: UnifiedOrder & { kind: 'transport' } }) {
  const router = useRouter();
  const job = item.data;
  const st = TJB_STATUS[job.status] ?? TJB_STATUS.AVAILABLE;
  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const Icon = isDisposal ? Recycle : Truck;
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';

  return (
    <TouchableOpacity
      style={[s.card, item.isActive && s.cardActive]}
      onPress={() => {
        haptics.light();
        router.push({ pathname: '/(buyer)/transport-job/[id]', params: { id: job.id } } as any);
      }}
      activeOpacity={0.88}
    >
      {item.isActive && <View style={s.activeStrip} />}
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <Icon size={11} color="#6b7280" />
            <Text style={s.typeTagText}>{typeLabel}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: st.bg }]}>
            <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={s.orderNum}>{job.jobNumber}</Text>
        {!isDisposal && (
          <Text style={s.orderSub} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
          </Text>
        )}
        {isDisposal && (
          <Text style={s.orderSub} numberOfLines={1}>
            {CARGO_LABEL[job.cargoType] ?? job.cargoType} · {job.pickupCity}
          </Text>
        )}
        <View style={s.metaRow}>
          <MapPin size={13} color="#6b7280" />
          <Text style={s.metaText} numberOfLines={1}>
            {job.pickupAddress}, {job.pickupCity}
          </Text>
        </View>
        <View style={s.metaRow}>
          <CalendarDays size={13} color="#6b7280" />
          <Text style={s.metaText}>{formatDate(job.pickupDate)}</Text>
        </View>
        {job.requiredVehicleType && (
          <View style={s.metaRow}>
            <Truck size={13} color="#6b7280" />
            <Text style={s.metaText} numberOfLines={1}>
              {VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType}
            </Text>
          </View>
        )}
        <View style={s.metaRow}>
          <Text style={job.rate > 0 ? s.priceChip : s.pricePending}>
            {job.rate > 0 ? `€${job.rate.toFixed(2)}` : 'Cena tiks noteikta'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [reqOrders, setReqOrders] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [ratingSkipId, setRatingSkipId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const loadOrders = useCallback(
    async (showSkeleton = true) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
      try {
        const [skipData, matData, reqData] = await Promise.all([
          api.skipHire.myOrders(token),
          api.orders.myOrders(token),
          api.transportJobs.myRequests(token),
        ]);
        setSkipOrders(Array.isArray(skipData) ? skipData : []);
        setMatOrders(Array.isArray(matData) ? matData : []);
        setReqOrders(Array.isArray(reqData) ? reqData : []);
      } catch {
        // show empty state on error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      loadOrders();
      // Poll every 30 s while the tab is focused
      const timer = setInterval(() => loadOrders(false), 30_000);
      return () => clearInterval(timer);
    }, [loadOrders]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders(false);
  };

  // Merge + sort: active first, then newest
  const unified = useMemo<UnifiedOrder[]>(() => {
    const list: UnifiedOrder[] = [];
    skipOrders.forEach((o) => {
      list.push({
        kind: 'skip',
        data: o,
        sortDate: new Date(o.deliveryDate).getTime(),
        isActive: skipBucket(o.status) === 'ACTIVE',
      });
    });
    matOrders.forEach((o) => {
      list.push({
        kind: 'material',
        data: o,
        sortDate: new Date(o.createdAt).getTime(),
        isActive: matBucket(o.status) === 'ACTIVE',
      });
    });
    reqOrders.forEach((o) => {
      list.push({
        kind: 'transport',
        data: o,
        sortDate: new Date(o.pickupDate).getTime(),
        isActive: reqBucket(o.status) === 'ACTIVE',
      });
    });
    return list.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.sortDate - a.sortDate;
    });
  }, [skipOrders, matOrders, reqOrders]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return unified;
    return unified.filter((item) => {
      const bucket =
        item.kind === 'skip'
          ? skipBucket(item.data.status)
          : item.kind === 'transport'
            ? reqBucket(item.data.status)
            : matBucket(item.data.status);
      return bucket === filter;
    });
  }, [unified, filter]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { ALL: unified.length, ACTIVE: 0, DONE: 0, CANCELLED: 0 };
    unified.forEach((item) => {
      const b =
        item.kind === 'skip'
          ? skipBucket(item.data.status)
          : item.kind === 'transport'
            ? reqBucket(item.data.status)
            : matBucket(item.data.status);
      c[b] = (c[b] ?? 0) + 1;
    });
    return c;
  }, [unified]);

  return (
    <ScreenContainer bg="#f2f2f7">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Pasūtījumi</Text>
            <Text style={s.subtitle}>
              {unified.length === 0 ? 'Nav pasūtījumu' : `${unified.length} kopā`}
            </Text>
          </View>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => {
              haptics.medium();
              setShowTypePicker(true);
            }}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#fff" strokeWidth={2.5} />
            <Text style={s.newBtnText}>Jauns</Text>
          </TouchableOpacity>
        </View>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = counts[f.key];
            return (
              <TouchableOpacity
                key={f.key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => {
                  haptics.light();
                  setFilter(f.key);
                }}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[s.chipCount, active && s.chipCountActive]}>
                    <Text style={[s.chipCountText, active && s.chipCountTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── List ── */}
        <View style={s.list}>
          {loading ? (
            <SkeletonCard count={4} />
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Package size={44} color="#d1d5db" />
              <Text style={s.emptyTitle}>
                {filter === 'ALL' ? 'Nav pasūtījumu' : 'Šajā kategorijā nav pasūtījumu'}
              </Text>
              <Text style={s.emptySub}>
                {filter === 'ALL' ? 'Veiciet savu pirmo pasūtījumu' : 'Mēģiniet mainīt filtru'}
              </Text>
              {filter === 'ALL' && (
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => setShowTypePicker(true)}
                  activeOpacity={0.85}
                >
                  <Text style={s.emptyBtnText}>Izveidot pasūtījumu</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((item, idx) => (
              <AnimatedCardWrapper key={`${item.kind}-${item.data.id}`} index={idx}>
                <UnifiedCard
                  item={item}
                  onRate={item.kind === 'skip' ? () => setRatingSkipId(item.data.id) : undefined}
                />
              </AnimatedCardWrapper>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {ratingSkipId && token && (
        <RatingModal
          visible={!!ratingSkipId}
          onClose={() => setRatingSkipId(null)}
          onSuccess={() => {
            setRatingSkipId(null);
            loadOrders();
          }}
          token={token}
          skipOrderId={ratingSkipId}
        />
      )}

      {/* ── Order type picker ── */}
      <BottomSheet
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        title="Jauns pasūtījums"
        subtitle="Izvēlieties pasūtījuma veidu"
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#fef2f2' }]}>
              <Trash2 size={22} color="#dc2626" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Konteinera īre</Text>
              <Text style={s.pickerOptionDesc}>Atkritumu konteinera piegāde un savākšana</Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order-request');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#eff6ff' }]}>
              <Package size={22} color="#2563eb" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Materiālu pasūtījums</Text>
              <Text style={s.pickerOptionDesc}>Smilts, grants, dolomīts un citi materiāli</Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/disposal');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#f0fdf4' }]}>
              <Trash2 size={22} color="#16a34a" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Atkritumu izvešana</Text>
              <Text style={s.pickerOptionDesc}>
                Celtniecības atkritumu savākšana un utilizācija
              </Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/transport');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#faf5ff' }]}>
              <Truck size={22} color="#7c3aed" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Transports A → B</Text>
              <Text style={s.pickerOptionDesc}>Kravu pārvadāšana uz galamērķi</Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerCancel}
            onPress={() => setShowTypePicker(false)}
            activeOpacity={0.75}
          >
            <Text style={s.pickerCancelText}>Atcelt</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  filtersRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#ffffff' },
  chipCount: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipCountText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  chipCountTextActive: { color: '#ffffff' },

  list: { paddingHorizontal: 16, gap: 10 },

  // ── Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardActive: { shadowOpacity: 0.09, shadowRadius: 12, elevation: 3 },
  activeStrip: { width: 4, backgroundColor: '#111827' },
  cardInner: { flex: 1, padding: 14 },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTagText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  orderNum: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  orderSub: { fontSize: 13, color: '#6b7280', marginBottom: 8 },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  driverName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  callText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 13, color: '#374151', flex: 1 },
  priceChip: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  pricePending: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },

  matRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  matDetail: { fontSize: 12, color: '#6b7280', flex: 1 },
  matPrice: { fontSize: 12, fontWeight: '600', color: '#374151' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  price: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#111827', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // ── Order type picker ──────────────────────────────────────
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pickerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionText: { flex: 1 },
  pickerOptionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  pickerOptionDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  pickerCancel: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  pickerCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
});
