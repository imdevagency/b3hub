import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Plus,
  Package,
  Truck,
  FileText,
  Clock,
  MapPin,
  ChevronRight,
  Trash2,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { useOrders } from '@/lib/use-orders';
import { BottomSheet } from '@/components/ui/BottomSheet';

type FilterKey = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

export default function OrdersScreen() {
  const router = useRouter();
  const {
    filtered,
    loading,
    refreshing, // Fixed: use refreshing from hook
    onRefresh: refresh, // Renamed for clarity
    filter,
    setFilter,
  } = useOrders();

  const [showTypePicker, setShowTypePicker] = useState(false);

  // Helper to change filter
  const handleFilterChange = (key: string) => {
    // Cast to expected type - the hook expects 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED'
    setFilter(key as any);
  };

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
      case 'rfq':
        return <RfqCard rfq={item.data} />;
      case 'skip':
        return <SkipOrderCard order={item.data} />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer>
      {/* ── Header ───────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Pasūtījumi</Text>
        <TouchableOpacity style={s.headerButton} onPress={handleNewOrder} activeOpacity={0.8}>
          <Plus size={24} color="#111827" />
        </TouchableOpacity>
      </View>

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
        </ScrollView>
      </View>

      {/* ── List ─────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={refresh} />}
        ListEmptyComponent={
          !loading ? (
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
          ) : null
        }
      />

      {/* ── New Order Sheet ──────────────────────────────────── */}
      <BottomSheet isVisible={showTypePicker} onClose={() => setShowTypePicker(false)}>
        <View style={s.sheetContent}>
          <Text style={s.sheetTitle}>Jauns pasūtījums</Text>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/catalog');
            }}
          >
            <View style={[s.sheetIcon, { backgroundColor: '#eff6ff' }]}>
              <Package size={24} color="#3b82f6" />
            </View>
            <View style={s.sheetText}>
              <Text style={s.sheetOptionTitle}>Materiāli</Text>
              <Text style={s.sheetOptionDesc}>Smiltis, šķembas, melnzeme</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/skip-order/new');
            }}
          >
            <View style={[s.sheetIcon, { backgroundColor: '#f0fdf4' }]}>
              <Trash2 size={24} color="#22c55e" />
            </View>
            <View style={s.sheetText}>
              <Text style={s.sheetOptionTitle}>Konteiners</Text>
              <Text style={s.sheetOptionDesc}>Būvgružu izvešana</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/rfq/new');
            }}
          >
            <View style={[s.sheetIcon, { backgroundColor: '#fff7ed' }]}>
              <FileText size={24} color="#f97316" />
            </View>
            <View style={s.sheetText}>
              <Text style={s.sheetOptionTitle}>Cenu aptauja (RFQ)</Text>
              <Text style={s.sheetOptionDesc}>Specifiski apjomi vai materiāli</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sheetOption}
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/transport-job/new');
            }}
          >
            <View style={[s.sheetIcon, { backgroundColor: '#f1f5f9' }]}>
              <Truck size={24} color="#64748b" />
            </View>
            <View style={s.sheetText}>
              <Text style={s.sheetOptionTitle}>Transports A → B</Text>
              <Text style={s.sheetOptionDesc}>Tikai pārvadājums</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
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

function MaterialOrderCard({ order }: { order: any }) {
  const router = useRouter();
  const statusColors = getStatusColors(order.status);
  const itemsCount = order.items?.length || 0;
  const firstItemName = order.items?.[0]?.product?.name || 'Materiālu pasūtījums';
  const displayTitle = itemsCount > 1 ? `${firstItemName} +${itemsCount - 1}` : firstItemName;

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/order/${order.id}`)}
    >
      <View style={s.cardHeader}>
        <View style={s.typeRow}>
          <Package size={16} color="#64748b" />
          <Text style={s.orderId}>#{order.orderNumber}</Text>
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
        <Text style={s.price}>€{order.totalAmount}</Text>
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
        {req.pickupAddress.split(',')[0]} → {req.deliveryAddress.split(',')[0]}
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
        <Text style={s.price}>—</Text>
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
          <Trash2 size={16} color="#64748b" />
          <Text style={s.orderId}>#{order.orderNumber}</Text>
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
        <Text style={s.price}>€{order.totalAmount}</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterContainer: {
    backgroundColor: '#fff',
    paddingBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  chipTextActive: {
    color: '#fff',
  },

  list: {
    padding: 20,
    gap: 16,
    paddingBottom: 100,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
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
    fontWeight: '600',
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
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
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
    fontWeight: '600',
    fontSize: 15,
  },

  // Sheet
  sheetContent: {
    paddingBottom: 40,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetText: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  sheetOptionDesc: {
    fontSize: 14,
    color: '#64748b',
  },
});
