import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  Plus,
  Package,
  HardHat,
  Truck,
  FileText,
  Clock,
  MapPin,
  ChevronRight,
  Trash2,
  Calendar,
  AlertCircle,
  Link2,
  Search,
  X,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { useOrders, type FilterKey } from '@/lib/use-orders';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function OrdersScreen() {
  const router = useRouter();
  const {
    filtered,
    loading,
    refreshing,
    onRefresh: refresh,
    filter,
    setFilter,
    query,
    setQuery,
    error,
  } = useOrders();

  const [showTypePicker, setShowTypePicker] = useState(false);

  const handleFilterChange = (key: FilterKey) => setFilter(key);

  const handleNewOrder = () => {
    setShowTypePicker(true);
  };

  const renderItem = ({ item }: { item: any }) => {
    // UnifiedOrder structure: { kind, data, ... }
    switch (item.kind) {
      case 'material':
        return <MaterialOrderCard order={item.data} />;
      case 'transport':
        return <TransportRequestCard req={item.data} />;
      case 'disposal':
        return <DisposalOrderCard req={item.data} />;
      case 'rfq':
        return <RfqCard rfq={item.data} />;
      case 'skip':
        return <SkipOrderCard order={item.data} />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer standalone bg="#ffffff">
      {/* ── Header ───────────────────────────────────────────── */}
      <ScreenHeader
        title="Pasūtījumi"
        onBack={null}
        right={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNewOrder}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
              borderWidth: 1,
              borderColor: '#F9FAFB',
            }}
          >
            <Plus size={24} color="#111827" />
          </TouchableOpacity>
        }
      />

      {/* ── Filters ──────────────────────────────────────────── */}
      <View style={s.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          <FilterChip
            label="Visi"
            active={filter === 'ALL'}
            onPress={() => handleFilterChange('ALL')}
          />
          <FilterChip
            label="Aktīvie"
            active={filter === 'ACTIVE'}
            onPress={() => handleFilterChange('ACTIVE')}
          />
          <FilterChip
            label="Pabeigtie"
            active={filter === 'DONE'}
            onPress={() => handleFilterChange('DONE')}
          />
          <FilterChip
            label="Atceltie"
            active={filter === 'CANCELLED'}
            onPress={() => handleFilterChange('CANCELLED')}
          />
        </ScrollView>
      </View>

      {/* ── Search ───────────────────────────────────────────── */}
      <View style={s.searchRow}>
        <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Meklēt pēc adreses, materiāla..."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ─────────────────────────────────────────────── */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={{ gap: 16 }}>
              <SkeletonCard count={3} />
            </View>
          ) : error ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTitle}>Neizdevās ielādēt</Text>
              <Text style={s.emptyText}>Pārbaudiet interneta savienojumu un mēģiniet vēlreiz.</Text>
              <TouchableOpacity style={s.emptyButton} onPress={() => refresh()} activeOpacity={0.8}>
                <Text style={s.emptyButtonText}>Mēģināt vēlreiz</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Package size={32} color="#94a3b8" />
              </View>
              <Text style={s.emptyTitle}>Nav pasūtījumu</Text>
              <Text style={s.emptyText}>Veiciet jaunu pasūtījumu vai RFQ, lai sāktu.</Text>
              <TouchableOpacity style={s.emptyButton} onPress={handleNewOrder} activeOpacity={0.8}>
                <Text style={s.emptyButtonText}>Jauns pasūtījums</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* ── New Order Sheet ──────────────────────────────────── */}
      <BottomSheet visible={showTypePicker} onClose={() => setShowTypePicker(false)}>
        <View style={s.sheetContent}>
          <Text style={s.sheetTitle}>Jauns pasūtījums</Text>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/catalog');
            }}
            activeOpacity={0.7}
          >
            <View style={s.uberIconBox}>
              <HardHat size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View style={s.sheetText}>
              <Text style={s.uberOptionTitle}>Materiāli</Text>
              <Text style={s.uberOptionDesc}>Smiltis, šķembas, melnzeme</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order');
            }}
            activeOpacity={0.7}
          >
            <View style={s.uberIconBox}>
              <Package size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View style={s.sheetText}>
              <Text style={s.uberOptionTitle}>Konteiners</Text>
              <Text style={s.uberOptionDesc}>Konteiners uz vietas (noma)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/disposal');
            }}
            activeOpacity={0.7}
          >
            <View style={s.uberIconBox}>
              <Trash2 size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View style={s.sheetText}>
              <Text style={s.uberOptionTitle}>Utilizācija</Text>
              <Text style={s.uberOptionDesc}>Atkritumu izvešana no objekta</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order-request-new');
            }}
            activeOpacity={0.7}
          >
            <View style={s.uberIconBox}>
              <FileText size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View style={s.sheetText}>
              <Text style={s.uberOptionTitle}>Cenu aptauja (RFQ)</Text>
              <Text style={s.uberOptionDesc}>Specifiski apjomi vai materiāli</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/transport');
            }}
            activeOpacity={0.7}
          >
            <View style={s.uberIconBox}>
              <Truck size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View style={s.sheetText}>
              <Text style={s.uberOptionTitle}>Transports A → B</Text>
              <Text style={s.uberOptionDesc}>Tikai pārvadājums</Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

// ── Components ────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const DRIVER_TRANSIT_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

function MaterialOrderCard({ order }: { order: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(order.status);
  const itemsCount = order.items?.length || 0;
  const firstItemName = order.items?.[0]?.product?.name || 'Materiālu pasūtījums';
  const displayTitle = itemsCount > 1 ? `${firstItemName} +${itemsCount - 1}` : firstItemName;
  const activeJob = order.transportJobs?.find((j: any) => DRIVER_TRANSIT_STATUSES.has(j.status));
  const activeDriver = activeJob?.driver;
  const driverName = activeDriver?.firstName
    ? `${activeDriver.firstName} ${activeDriver.lastName ? activeDriver.lastName.charAt(0) + '.' : ''}`
    : null;

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/order/${order.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Package size={16} color="#64748b" />
          <Text style={s.orderId}>Materiāli</Text>
          <Text style={[s.orderId, { color: '#94a3b8', fontWeight: '400' as const }]}>
            · #{order.orderNumber}
          </Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[s.statusText, { color: statusColors.text }]}>
            {formatStatus(order.status)}
          </Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {displayTitle}
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <MapPin size={14} color="#94a3b8" />
          <Text style={s.metaText} numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color="#94a3b8" />
          <Text style={s.metaText}>
            {format(new Date(order.createdAt), 'd. MMM', { locale: lv })}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <Text style={s.price}>{order.totalAmount != null ? `€${order.totalAmount}` : '—'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {order.linkedSkipOrder && (
            <TouchableOpacity
              style={s.linkedSkipChip}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(buyer)/skip-order/${order.linkedSkipOrder.id}` as any);
              }}
              activeOpacity={0.8}
            >
              <Link2 size={11} color="#059669" />
              <Text style={s.linkedSkipChipText}>Konteiners</Text>
            </TouchableOpacity>
          )}
          {activeJob && driverName && <Text style={s.driverNameText}>{driverName}</Text>}
          {activeJob && (
            <TouchableOpacity
              style={s.liveChip}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(buyer)/transport-job/${activeJob.id}` as any);
              }}
              activeOpacity={0.8}
            >
              <View style={s.liveChipDot} />
              <Text style={s.liveChipText}>Live</Text>
            </TouchableOpacity>
          )}
          <View style={s.chevronBox}>
            <ChevronRight size={18} color="#94a3b8" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DisposalOrderCard({ req }: { req: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(req.status);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/transport-job/${req.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Trash2 size={16} color="#64748b" />
          <Text style={s.orderId}>Utilizācija</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[s.statusText, { color: statusColors.text }]}>
            {formatStatus(req.status)}
          </Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {(req.pickupAddress ?? '').split(',')[0] || 'Izvešanas vieta'}
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <MapPin size={14} color="#94a3b8" />
          <Text style={s.metaText} numberOfLines={1}>
            Atkritumu izvešana
          </Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color="#94a3b8" />
          <Text style={s.metaText}>
            {req.pickupDate
              ? format(new Date(req.pickupDate), 'd. MMM', { locale: lv })
              : 'Pēc vienošanās'}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <Text style={s.price}>{req.rate != null ? `€${req.rate}` : '—'}</Text>
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TransportRequestCard({ req }: { req: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(req.status);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/transport-job/${req.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Truck size={16} color="#64748b" />
          <Text style={s.orderId}>Transports</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[s.statusText, { color: statusColors.text }]}>
            {formatStatus(req.status)}
          </Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {(req.pickupAddress ?? '').split(',')[0] || 'Iekraušana'} →{' '}
        {(req.deliveryAddress ?? '').split(',')[0] || 'Piegāde'}
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <Clock size={14} color="#94a3b8" />
          <Text style={s.metaText}>
            {req.pickupDate
              ? format(new Date(req.pickupDate), 'd. MMM HH:mm', { locale: lv })
              : 'Pēc vienošanās'}
          </Text>
        </View>
      </View>

      {/* Spacer to align footer height if needed, or remove if content adjusts */}
      <View style={s.cardFooter}>
        <Text style={s.price}>{req.rate != null && req.rate > 0 ? `no €${req.rate}` : '—'}</Text>
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RfqCard({ rfq }: { rfq: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(rfq.status);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/rfq/${rfq.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <FileText size={16} color="#64748b" />
          <Text style={s.orderId}>Cenu aptauja</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[s.statusText, { color: statusColors.text }]}>
            {formatStatus(rfq.status)}
          </Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {rfq.title || 'Jauna cenu aptauja'}
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <AlertCircle size={14} color="#94a3b8" />
          <Text style={s.metaText}>{rfq._count?.quotes || 0} piedāvājumi</Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color="#94a3b8" />
          <Text style={s.metaText}>
            Termiņš:{' '}
            {rfq.deadline
              ? format(new Date(rfq.deadline), 'd. MMM', { locale: lv })
              : 'Nav termiņa'}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <Text style={s.price}>RFQ</Text>
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SkipOrderCard({ order }: { order: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(order.status);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/skip-order/${order.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Package size={16} color="#64748b" />
          <Text style={s.orderId}>Konteiners</Text>
          <Text style={[s.orderId, { color: '#94a3b8', fontWeight: '400' as const }]}>
            {' '}
            · #{order.orderNumber}
          </Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[s.statusText, { color: statusColors.text }]}>
            {formatStatus(order.status)}
          </Text>
        </View>
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {order.containerSize} m³ konteiners
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <MapPin size={14} color="#94a3b8" />
          <Text style={s.metaText} numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color="#94a3b8" />
          <Text style={s.metaText}>
            {order.deliveryDate
              ? format(new Date(order.deliveryDate), 'd. MMM', { locale: lv })
              : 'Nav datuma'}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <Text style={s.price}>{order.totalAmount != null ? `€${order.totalAmount}` : '—'}</Text>
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function getStatusColors(status: string) {
  switch (status) {
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      return { bg: '#dcfce7', text: '#166534' }; // Green
    case 'COMPLETED':
    case 'DELIVERED':
      return { bg: '#f1f5f9', text: '#475569' }; // Gray (done)
    case 'PENDING':
    case 'SUBMITTED':
    case 'OPEN':
      return { bg: '#fff7ed', text: '#9a3412' }; // Orange
    case 'CANCELLED':
    case 'REJECTED':
      return { bg: '#fef2f2', text: '#991b1b' }; // Red
    default:
      return { bg: '#f3f4f6', text: '#4b5563' };
  }
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    PENDING: 'Gaida',
    SUBMITTED: 'Iesniegts',
    CONFIRMED: 'Apstiprināts',
    IN_PROGRESS: 'Izpildē',
    DELIVERED: 'Piegādāts',
    COMPLETED: 'Pabeigts',
    CANCELLED: 'Atcelts',
    OPEN: 'Atvērts',
    CLOSED: 'Slēgts',
    ACCEPTED: 'Pieņemts',
    REJECTED: 'Noraidīts',
  };
  return map[status] || status;
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  filterContainer: {
    paddingTop: 12,
    backgroundColor: '#ffffff',
    paddingBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#ffffff',
  },

  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    marginBottom: 4, // Spacing handled by gap in FlatList usually, but gap not always supported on older RN
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderId: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 24,
  },
  cardMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748b',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  price: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  liveChipText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
  },
  linkedSkipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkedSkipChipText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#059669',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  driverNameText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#4b5563',
  },

  // Sheet
  sheetContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    marginBottom: 24,
    paddingHorizontal: 24,
    letterSpacing: -0.5,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
  },
  uberIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetText: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  uberOptionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  uberOptionDesc: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#64748b',
  },
});
