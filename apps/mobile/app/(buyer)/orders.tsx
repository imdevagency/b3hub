import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDateShort } from '@/lib/format';
import { t } from '@/lib/translations';
import { haptics } from '@/lib/haptics';
import { useOrders } from '@/lib/use-orders';
import type { UnifiedOrder, FilterKey } from '@/lib/use-orders';
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
  HardHat,
  Clock,
} from 'lucide-react-native';
import { RatingModal } from '@/components/ui/RatingModal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UNIT_SHORT, MAT_STATUS, TJB_STATUS, SIZE_LABEL, CATEGORY_LABELS } from '@/lib/materials';

// ── Constants ─────────────────────────────────────────────────

const WASTE_TYPE_LABEL: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Visi' },
  { key: 'ACTIVE', label: 'Aktīvie' },
  { key: 'DONE', label: 'Pabeigti' },
  { key: 'CANCELLED', label: 'Atcelti' },
];

// ── Unified card ──────────────────────────────────────────────

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
            <StatusPill label={status.label} bg={status.bg} color={status.color} />
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
            <Text style={s.metaText}>{formatDateShort(order.deliveryDate)}</Text>
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

  // RFQ (quote request — open / pending supplier responses)
  if (item.kind === 'rfq') {
    return <RfqCard item={item} />;
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
          <StatusPill label={st.label} bg={st.bg} color={st.color} />
        </View>
        <Text style={s.orderNum}>{order.orderNumber}</Text>
        <Text style={s.orderSub} numberOfLines={1}>
          {first
            ? `${first.material.name}${extra > 0 ? ` +${extra}` : ''}`
            : 'Materiālu pasūtījums'}
        </Text>
        {driver && activeJob && (
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
            <Text style={s.metaText}>{formatDateShort(order.deliveryDate)}</Text>
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
          <StatusPill label={st.label} bg={st.bg} color={st.color} />
        </View>
        <Text style={s.orderNum}>{job.jobNumber}</Text>
        {!isDisposal && (
          <Text style={s.orderSub} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
          </Text>
        )}
        {isDisposal && (
          <Text style={s.orderSub} numberOfLines={1}>
            {WASTE_TYPE_LABEL[job.cargoType] ?? job.cargoType} · {job.pickupCity}
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
          <Text style={s.metaText}>{formatDateShort(job.pickupDate)}</Text>
        </View>
        {job.requiredVehicleType && (
          <View style={s.metaRow}>
            <Truck size={13} color="#6b7280" />
            <Text style={s.metaText} numberOfLines={1}>
              {job.requiredVehicleType}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── RFQ card (quote request awaiting / responding supplier) ──

const RFQ_STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: 'Gaida piedāvājumus', bg: '#fef3c7', color: '#d97706' },
  QUOTED:    { label: 'Ir piedāvājumi',      bg: '#d1fae5', color: '#059669' },
  ACCEPTED:  { label: 'Pieņemts',            bg: '#dcfce7', color: '#15803d' },
  CANCELLED: { label: 'Atcelts',             bg: '#f3f4f6', color: '#6b7280' },
  EXPIRED:   { label: 'Beidzies',            bg: '#f3f4f6', color: '#9ca3af' },
};

function RfqCard({ item }: { item: UnifiedOrder & { kind: 'rfq' } }) {
  const router = useRouter();
  const rfq = item.data;
  const st = RFQ_STATUS_LABEL[rfq.status] ?? RFQ_STATUS_LABEL.PENDING;
  const responseCount = rfq.responses?.length ?? 0;

  return (
    <TouchableOpacity
      style={[s.card, item.isActive && s.cardActive]}
      onPress={() => {
        haptics.light();
        router.push({ pathname: '/(buyer)/rfq/[id]', params: { id: rfq.id } } as any);
      }}
      activeOpacity={0.88}
    >
      {item.isActive && <View style={s.activeStrip} />}
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <HardHat size={11} color="#6b7280" />
            <Text style={s.typeTagText}>Pieprasījums</Text>
          </View>
          <StatusPill label={st.label} bg={st.bg} color={st.color} />
        </View>
        <Text style={s.orderNum}>{rfq.requestNumber}</Text>
        <Text style={s.orderSub} numberOfLines={1}>
          {CATEGORY_LABELS[rfq.materialCategory] ?? rfq.materialCategory} · {rfq.materialName}
        </Text>
        <View style={s.metaRow}>
          <MapPin size={13} color="#6b7280" />
          <Text style={s.metaText} numberOfLines={1}>
            {rfq.deliveryCity || rfq.deliveryAddress}
          </Text>
        </View>
        <View style={s.matRow}>
          <Text style={s.matDetail}>
            {rfq.quantity} {UNIT_SHORT[rfq.unit] ?? rfq.unit}
          </Text>
          {responseCount > 0 && (
            <Text style={[s.matPrice, { color: '#059669' }]}>
              {responseCount} pied.
            </Text>
          )}
        </View>
        <View style={s.cardFooter}>
          {rfq.status === 'QUOTED' ? (
            <Text style={[s.price, { color: '#059669', fontSize: 13 }]}>
              Skatīt piedāvājumus →
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color="#9ca3af" />
              <Text style={[s.price, { color: '#9ca3af', fontSize: 12, fontWeight: '500' }]}>
                {rfq.status === 'PENDING' ? 'Gaidām atbildes...' : st.label}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color="#9ca3af" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { loading, refreshing, onRefresh, filter, setFilter, unified, filtered, counts } =
    useOrders();
  const [ratingSkipId, setRatingSkipId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

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
            <EmptyState
              icon={<Package size={44} color="#d1d5db" />}
              title={filter === 'ALL' ? 'Nav pasūtījumu' : 'Šajā kategorijā nav pasūtījumu'}
              subtitle={
                filter === 'ALL' ? 'Veiciet savu pirmo pasūtījumu' : 'Mēģiniet mainīt filtru'
              }
              action={
                filter === 'ALL' ? (
                  <TouchableOpacity
                    style={s.emptyBtn}
                    onPress={() => setShowTypePicker(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.emptyBtnText}>Izveidot pasūtījumu</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          ) : (
            filtered.map((item) => (
              <UnifiedCard
                key={`${item.kind}-${item.data.id}`}
                item={item}
                onRate={item.kind === 'skip' ? () => setRatingSkipId(item.data.id) : undefined}
              />
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
