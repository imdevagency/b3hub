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
import { formatDateShort } from '@/lib/format';
import { t } from '@/lib/translations';
import { haptics } from '@/lib/haptics';
import { useOrders } from '@/lib/use-orders';
import type { UnifiedOrder, FilterKey } from '@/lib/use-orders';
import { useAuth } from '@/lib/auth-context';
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

function MinimalStatus({ label }: { label: string }) {
  return (
    <View style={s.minimalStatus}>
      <Text style={s.minimalStatusText}>{label}</Text>
    </View>
  );
}

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
        <View style={s.cardInner}>
          <View style={s.cardTop}>
            <View style={s.typeTag}>
              <Trash2 size={12} color="#475569" />
              <Text style={[s.typeTagText, { color: '#475569', fontSize: 12 }]}>Konteiners</Text>
            </View>
            <MinimalStatus label={status.label} />
          </View>
          <Text style={s.orderTitle}>{SIZE_LABEL[order.skipSize] ?? order.skipSize}</Text>
          <Text style={s.orderRef}>{order.orderNumber}</Text>
          <View style={s.metaRow}>
            <MapPin size={14} color="#64748b" />
            <Text style={s.metaText} numberOfLines={1}>
              {order.location}
            </Text>
          </View>
          <View style={s.metaRow}>
            <CalendarDays size={14} color="#64748b" />
            <Text style={s.metaText}>{formatDateShort(order.deliveryDate)}</Text>
          </View>
          <View style={s.cardFooter}>
            <Text style={s.price}>€{order.price}</Text>
            {canRate && onRate ? (
              <TouchableOpacity style={s.actionChip} onPress={onRate} activeOpacity={0.8}>
                <Star size={12} color="#64748b" fill="#64748b" />
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
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <Truck size={12} color="#475569" />
            <Text style={[s.typeTagText, { color: '#475569', fontSize: 12 }]}>Materiāli</Text>
          </View>
          <MinimalStatus label={st.label} />
        </View>
        <Text style={s.orderTitle} numberOfLines={1}>
          {first
            ? `${first.material.name}${extra > 0 ? ` +${extra}` : ''}`
            : 'Materiālu pasūtījums'}
        </Text>
        <Text style={s.orderRef}>{order.orderNumber}</Text>
        {driver && activeJob && (
          <View style={s.driverRow}>
            <User size={14} color="#475569" />
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
            <MapPin size={14} color="#64748b" />
            <Text style={s.metaText} numberOfLines={1}>
              {order.deliveryAddress}
              {order.deliveryCity ? `, ${order.deliveryCity}` : ''}
            </Text>
          </View>
        ) : null}
        {order.deliveryDate ? (
          <View style={s.metaRow}>
            <CalendarDays size={14} color="#64748b" />
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
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && onRate ? (
            <TouchableOpacity style={s.actionChip} onPress={onRate} activeOpacity={0.8}>
              <Star size={12} color="#64748b" fill="#64748b" />
              <Text style={s.actionChipText}>Vērtēt</Text>
            </TouchableOpacity>
          ) : (
            <ChevronRight size={16} color="#94a3b8" />
          )}
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
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <Icon size={12} color="#475569" />
            <Text style={[s.typeTagText, { color: '#475569', fontSize: 12 }]}>{typeLabel}</Text>
          </View>
          <MinimalStatus label={st.label} />
        </View>
        {!isDisposal && (
          <Text style={s.orderTitle} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
          </Text>
        )}
        {isDisposal && (
          <Text style={s.orderTitle} numberOfLines={1}>
            {WASTE_TYPE_LABEL[job.cargoType] ?? job.cargoType} · {job.pickupCity}
          </Text>
        )}
        <Text style={s.orderRef}>{job.jobNumber}</Text>
        <View style={s.metaRow}>
          <MapPin size={14} color="#64748b" />
          <Text style={s.metaText} numberOfLines={1}>
            {job.pickupAddress}, {job.pickupCity}
          </Text>
        </View>
        <View style={s.metaRow}>
          <CalendarDays size={14} color="#64748b" />
          <Text style={s.metaText}>{job.pickupDate ? formatDateShort(job.pickupDate) : '—'}</Text>
        </View>
        {job.requiredVehicleType && (
          <View style={s.metaRow}>
            <Truck size={14} color="#64748b" />
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

const RFQ_STATUS_LABEL: Record<string, { label: string }> = {
  PENDING: { label: 'Gaida piedāvājumus' },
  QUOTED: { label: 'Ir piedāvājumi' },
  ACCEPTED: { label: 'Pieņemts' },
  CANCELLED: { label: 'Atcelts' },
  EXPIRED: { label: 'Beidzies' },
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
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={s.typeTag}>
            <HardHat size={12} color="#475569" />
            <Text style={[s.typeTagText, { color: '#475569', fontSize: 12 }]}>Pieprasījums</Text>
          </View>
          <MinimalStatus label={st.label} />
        </View>
        <Text style={s.orderTitle} numberOfLines={1}>
          {CATEGORY_LABELS[rfq.materialCategory] ?? rfq.materialCategory} · {rfq.materialName}
        </Text>
        <Text style={s.orderRef}>{rfq.requestNumber}</Text>
        <View style={s.metaRow}>
          <MapPin size={14} color="#64748b" />
          <Text style={s.metaText} numberOfLines={1}>
            {rfq.deliveryCity || rfq.deliveryAddress}
          </Text>
        </View>
        <View style={s.matRow}>
          <Text style={s.matDetail}>
            {rfq.quantity} {UNIT_SHORT[rfq.unit] ?? rfq.unit}
          </Text>
          {responseCount > 0 && (
            <Text style={[s.matPrice, { color: '#475569' }]}>{responseCount} pied.</Text>
          )}
        </View>
        <View style={s.cardFooter}>
          {rfq.status === 'QUOTED' ? (
            <Text style={[s.price, { color: '#374151', fontSize: 13, fontWeight: '600' }]}>
              Skatīt piedāvājumus →
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color="#94a3b8" />
              <Text style={[s.price, { color: '#94a3b8', fontSize: 12, fontWeight: '500' }]}>
                {rfq.status === 'PENDING' ? 'Gaidām atbildes...' : st.label}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { loading, refreshing, onRefresh, filter, setFilter, unified, filtered, counts } =
    useOrders();
  const { token } = useAuth();
  const [ratingSkipId, setRatingSkipId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  return (
    <ScreenContainer bg="#f9fafb">
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
              {unified.length === 0
                ? 'Nav pasūtījumu'
                : counts.ACTIVE > 0
                  ? `${counts.ACTIVE} aktīvi · ${unified.length} kopā`
                  : `${unified.length} kopā`}
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
                onRate={
                  item.kind === 'skip'
                    ? () => setRatingSkipId(item.data.id)
                    : item.kind === 'material'
                      ? () => router.push(`/review/${item.data.id}` as any)
                      : undefined
                }
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
            onRefresh();
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
            <View style={[s.pickerIcon, { backgroundColor: '#f1f5f9' }]}>
              <Package size={22} color="#475569" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Konteinera īre</Text>
              <Text style={s.pickerOptionDesc}>Atkritumu konteinera piegāde un savākšana</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order-request-new');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#f1f5f9' }]}>
              <HardHat size={22} color="#475569" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Materiālu pasūtījums</Text>
              <Text style={s.pickerOptionDesc}>Smilts, grants, dolomīts un citi materiāli</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/disposal');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#f1f5f9' }]}>
              <Trash2 size={22} color="#475569" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Atkritumu izvešana</Text>
              <Text style={s.pickerOptionDesc}>
                Celtniecības atkritumu savākšana un utilizācija
              </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.pickerOption}
            activeOpacity={0.8}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/transport');
            }}
          >
            <View style={[s.pickerIcon, { backgroundColor: '#f1f5f9' }]}>
              <Truck size={22} color="#475569" strokeWidth={1.8} />
            </View>
            <View style={s.pickerOptionText}>
              <Text style={s.pickerOptionTitle}>Transports A → B</Text>
              <Text style={s.pickerOptionDesc}>Kravu pārvadāšana uz galamērķi</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" />
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
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  chipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  chipTextActive: { color: '#111827' },
  chipCount: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipCountActive: { backgroundColor: '#e5e7eb' },
  chipCountText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  chipCountTextActive: { color: '#111827' },
  list: { paddingHorizontal: 16, gap: 12 },
  listContent: { padding: 16, gap: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    marginBottom: 0,
    flexDirection: 'column',
  },
  cardActive: {
    borderColor: '#e8edf3',
    backgroundColor: '#ffffff',
  },
  activeStrip: { display: 'none' },
  cardInner: { padding: 16 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeTagText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  minimalStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  minimalStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  orderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  orderRef: { fontSize: 13, color: '#94a3b8', marginBottom: 12, fontWeight: '500' },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  driverName: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { fontSize: 14, color: '#64748b', flex: 1, fontWeight: '500' },
  matRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  matDetail: { fontSize: 14, color: '#111827', flex: 1, fontWeight: '600' },
  matPrice: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  price: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1, letterSpacing: -0.5 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#111827', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
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
    backgroundColor: '#fafbfc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#edf1f5',
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
  pickerOptionDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  pickerCancel: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  pickerCancelText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
});
