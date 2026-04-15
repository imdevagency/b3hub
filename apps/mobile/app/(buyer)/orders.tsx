import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Leaf,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { useOrders } from '@/lib/use-orders';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { SIZE_LABEL } from '@/lib/materials';

const PAYMENT_BADGE: Record<string, { label: string; bg: string; color: string } | undefined> = {
  PENDING: { label: 'Gaida maksājumu', bg: '#fef3c7', color: '#92400e' },
  AUTHORIZED: { label: 'Autorizēts', bg: '#eff6ff', color: '#1d4ed8' },
  CAPTURED: { label: 'Iekasēts', bg: '#dcfce7', color: '#166534' },
  PARTIALLY_PAID: { label: 'Daļēji apmaksāts', bg: '#fef9c3', color: '#713f12' },
  REFUNDED: { label: 'Atmaksāts', bg: '#f3f4f6', color: '#6b7280' },
  FAILED: { label: 'Maksājums neizdevās', bg: '#fee2e2', color: '#991b1b' },
  // PAID and RELEASED intentionally omitted — no badge needed
};

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return null;
  const meta = PAYMENT_BADGE[status];
  if (!meta) return null;
  return <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="sm" />;
}
import { haptics } from '@/lib/haptics';
import { estimateCo2Kg, formatCo2 } from '@/lib/co2';
import type { ApiTransportJob } from '@/lib/api';

export default function OrdersScreen() {
  const router = useRouter();
  const {
    unified,
    loading,
    refreshing,
    onRefresh: refresh,
    query,
    setQuery,
    error,
  } = useOrders();

  const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');

  const { token } = useAuth();
  const [showTypePicker, setShowTypePicker] = useState(false);

  type KindFilter = 'all' | 'material' | 'logistics' | 'skip' | 'rfq';
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

  // Sustainability: aggregate CO2 from all delivered transport/disposal jobs
  const { totalCo2Kg, totalTonnes, deliveredJobCount } = React.useMemo(() => {
    let co2Sum = 0;
    let tonnes = 0;
    let count = 0;
    for (const item of unified) {
      if (item.kind !== 'transport' && item.kind !== 'disposal') continue;
      const job = item.data as ApiTransportJob;
      if (job.status !== 'DELIVERED') continue;
      const weightTonnes =
        (job.actualWeightKg != null ? job.actualWeightKg : (job.cargoWeight ?? 0)) / 1000;
      const co2 = estimateCo2Kg(job.distanceKm, weightTonnes);
      if (co2 != null) {
        co2Sum += co2;
        tonnes += weightTonnes;
        count++;
      }
    }
    return { totalCo2Kg: co2Sum, totalTonnes: tonnes, deliveredJobCount: count };
  }, [unified]);

  const showCo2Banner = !loading && deliveredJobCount > 0;

  const tabFiltered = React.useMemo(
    () => (activeTab === 'active' ? unified.filter((i) => i.isActive) : unified.filter((i) => !i.isActive)),
    [unified, activeTab],
  );

  const kindCounts = React.useMemo(
    () => ({
      all: tabFiltered.length,
      material: tabFiltered.filter((i) => i.kind === 'material').length,
      logistics: tabFiltered.filter((i) => i.kind === 'transport' || i.kind === 'disposal').length,
      skip: tabFiltered.filter((i) => i.kind === 'skip').length,
      rfq: tabFiltered.filter((i) => i.kind === 'rfq').length,
    }),
    [tabFiltered],
  );

  const hasMultipleKinds = React.useMemo(() => {
    const kinds = new Set(unified.map((i) => (i.kind === 'disposal' ? 'logistics' : i.kind)));
    return kinds.size > 1;
  }, [unified]);

  const displayItems = React.useMemo(() => {
    let base = tabFiltered;
    if (query.trim().length >= 2) {
      const q = query.trim().toLowerCase();
      // inline search since we're bypassing useOrders' filtered
      base = base.filter((i) => {
        const d = i.data as any;
        const parts: string[] = [];
        if (d.orderNumber) parts.push(d.orderNumber);
        if (d.jobNumber) parts.push(d.jobNumber);
        if (d.deliveryAddress) parts.push(d.deliveryAddress);
        if (d.pickupAddress) parts.push(d.pickupAddress);
        if (d.dropoffAddress) parts.push(d.dropoffAddress);
        if (d.material?.name) parts.push(d.material.name);
        if (d.title) parts.push(d.title);
        if (d.supplier?.name) parts.push(d.supplier.name);
        if (d.buyer?.name) parts.push(d.buyer.name);
        return parts.join(' ').toLowerCase().includes(q);
      });
    }
    if (kindFilter === 'all') return base;
    if (kindFilter === 'logistics')
      return base.filter((i) => i.kind === 'transport' || i.kind === 'disposal');
    return base.filter((i) => i.kind === kindFilter);
  }, [tabFiltered, kindFilter, query]);

  const [searchFocused, setSearchFocused] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleTabChange = (tab: 'active' | 'done') => {
    haptics.light();
    setActiveTab(tab);
    setKindFilter('all');
  };

  const handleNewOrder = () => {
    haptics.light();
    setShowTypePicker(true);
  };

  const renderItem = useCallback(({ item }: { item: any }) => {
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
  }, []);

  return (
    <ScreenContainer bg="#ffffff">
      {/* ── Uber Header ──────────────────────────────────────── */}
      <View style={s.uberHeader}>
        <Text style={s.uberTitle}>Pasūtījumi</Text>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={s.headerRoundBtn}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              setShowSearch((v) => !v);
            }}
          >
            <Search size={20} color={showSearch ? '#00A878' : '#111827'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerRoundBtn}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/schedules' as any);
            }}
          >
            <Calendar size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerRoundBtn} activeOpacity={0.8} onPress={handleNewOrder}>
            <Plus size={22} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Segmented Control ────────────────────────────────── */}
      <View style={s.segmentWrap}>
        <View style={s.segmentTrack}>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 'active' && s.segmentBtnActive]}
            onPress={() => handleTabChange('active')}
            activeOpacity={0.8}
          >
            <Text style={[s.segmentText, activeTab === 'active' && s.segmentTextActive]}>
              Aktīvie
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 'done' && s.segmentBtnActive]}
            onPress={() => handleTabChange('done')}
            activeOpacity={0.8}
          >
            <Text style={[s.segmentText, activeTab === 'done' && s.segmentTextActive]}>
              Vēsture
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Collapsible search + type filters ────────────────── */}
      {showSearch && (
        <View style={s.collapsibleFilters}>
          <View style={[s.searchRow, searchFocused && s.searchRowFocused]}>
            <Search size={16} color={searchFocused ? '#00A878' : '#9ca3af'} style={{ marginRight: 8 }} />
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { haptics.light(); setQuery(''); }} hitSlop={8}>
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          {hasMultipleKinds && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.typeScrollContent}
            >
              <TypeChip label="Visi" count={kindCounts.all} active={kindFilter === 'all'} onPress={() => { haptics.light(); setKindFilter('all'); }} />
              {kindCounts.material > 0 && <TypeChip label="Materiāli" count={kindCounts.material} active={kindFilter === 'material'} onPress={() => { haptics.light(); setKindFilter('material'); }} />}
              {kindCounts.logistics > 0 && <TypeChip label="Transports" count={kindCounts.logistics} active={kindFilter === 'logistics'} onPress={() => { haptics.light(); setKindFilter('logistics'); }} />}
              {kindCounts.skip > 0 && <TypeChip label="Konteineri" count={kindCounts.skip} active={kindFilter === 'skip'} onPress={() => { haptics.light(); setKindFilter('skip'); }} />}
              {kindCounts.rfq > 0 && <TypeChip label="RFQ" count={kindCounts.rfq} active={kindFilter === 'rfq'} onPress={() => { haptics.light(); setKindFilter('rfq'); }} />}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      <FlatList
        style={{ flex: 1 }}
        data={displayItems}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          showCo2Banner ? (
            <View style={s.co2Banner}>
              <View style={s.co2Left}>
                <Leaf size={18} color="#16a34a" fill="#16a34a" />
                <View>
                  <Text style={s.co2Value}>{formatCo2(totalCo2Kg)}</Text>
                  <Text style={s.co2Label}>
                    Kopējais CO₂ · {totalTonnes.toFixed(1)} t piegādāts ({deliveredJobCount} reises)
                  </Text>
                </View>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={{ gap: 16 }}>
              <SkeletonCard count={3} />
            </View>
          ) : error ? (
            <EmptyState
              icon={<AlertCircle size={32} color="#f87171" />}
              title="Neizdevās ielādēt"
              subtitle="Pārbaudiet interneta savienojumu un mēģiniet vēlreiz."
              action={
                <TouchableOpacity
                  style={s.emptyButton}
                  onPress={() => refresh()}
                  activeOpacity={0.8}
                >
                  <Text style={s.emptyButtonText}>Mēģināt vēlreiz</Text>
                </TouchableOpacity>
              }
            />
          ) : (
            <EmptyState
              icon={<Package size={32} color="#94a3b8" />}
              title="Nav pasūtījumu"
              subtitle="Veiciet jaunu pasūtījumu vai RFQ, lai sāktu."
              action={
                <TouchableOpacity
                  style={s.emptyButton}
                  onPress={handleNewOrder}
                  activeOpacity={0.8}
                >
                  <Text style={s.emptyButtonText}>Jauns pasūtījums</Text>
                </TouchableOpacity>
              }
            />
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
              haptics.light();
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
              haptics.light();
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
              haptics.light();
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
              haptics.light();
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

function TypeChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.typeChip, active && s.typeChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{label}</Text>
      <View style={[s.typeChipBadge, active && s.typeChipBadgeActive]}>
        <Text style={[s.typeChipBadgeText, active && s.typeChipBadgeTextActive]}>{count}</Text>
      </View>
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

const MaterialOrderCard = React.memo(function MaterialOrderCard({ order }: { order: any }) {
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
        <StatusPill
          label={formatStatus(order.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {displayTitle}
      </Text>

      {order.project?.name && (
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <View style={s.projectPill}>
            <HardHat size={11} color="#1d4ed8" />
            <Text style={s.projectPillText} numberOfLines={1}>
              {order.project.name}
            </Text>
          </View>
        </View>
      )}

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
              : 'Cik drīz iespējams'}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <View style={{ gap: 4 }}>
          <Text style={s.price}>{order.totalAmount != null ? `€${order.totalAmount}` : '—'}</Text>
          <PaymentBadge status={order.paymentStatus} />
        </View>
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
});

const DisposalOrderCard = React.memo(function DisposalOrderCard({ req }: { req: any }) {
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
        <StatusPill
          label={formatStatus(req.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
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
        {req.rate != null ? (
          <Text style={s.price}>€{req.rate}</Text>
        ) : (
          <Text style={[s.price, { color: '#94a3b8', fontSize: 13, alignSelf: 'center', fontFamily: 'Inter_600SemiBold' }]}>Tiks precizēts</Text>
        )}
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const TransportRequestCard = React.memo(function TransportRequestCard({ req }: { req: any }) {
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
        <StatusPill
          label={formatStatus(req.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
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
        {req.rate != null && req.rate > 0 ? (
          <Text style={s.price}>no €{req.rate}</Text>
        ) : (
          <Text style={[s.price, { color: '#94a3b8', fontSize: 13, alignSelf: 'center', fontFamily: 'Inter_600SemiBold' }]}>Tiks precizēts</Text>
        )}
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const RfqCard = React.memo(function RfqCard({ rfq }: { rfq: any }) {
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
        <StatusPill
          label={formatStatus(rfq.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
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
});

const SkipOrderCard = React.memo(function SkipOrderCard({ order }: { order: any }) {
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
        <StatusPill
          label={formatStatus(order.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text style={s.cardTitle} numberOfLines={2}>
        {SIZE_LABEL[order.skipSize as string] ?? order.skipSize}
      </Text>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <MapPin size={14} color="#94a3b8" />
          <Text style={s.metaText} numberOfLines={1}>
            {order.location}
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
        {order.price != null ? (
            <Text style={s.price}>€{order.price.toFixed(2)}</Text>
          ) : (
            <Text style={[s.price, { color: '#94a3b8', fontSize: 13, alignSelf: 'center', fontFamily: 'Inter_600SemiBold', marginBottom: 2 }]}>Gaida cenu</Text>
          )}
        <View style={s.chevronBox}>
          <ChevronRight size={18} color="#94a3b8" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

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
  uberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  uberTitle: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerRoundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#111827',
  },
  collapsibleFilters: {
    backgroundColor: '#fff',
    paddingBottom: 8,
  },
  typeScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchRowFocused: {
    borderColor: '#00A878',
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeChipActive: {
    backgroundColor: '#00A878',
    borderColor: '#00A878',
  },
  typeChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#4b5563',
  },
  typeChipTextActive: {
    color: '#ffffff',
  },
  typeChipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  typeChipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  typeChipBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#6b7280',
  },
  typeChipBadgeTextActive: {
    color: '#ffffff',
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  co2Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  co2Left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  co2Value: { fontSize: 16, fontWeight: '700', color: '#15803d' },
  co2Label: { fontSize: 12, color: '#16a34a', marginTop: 2 },

  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 22,
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
    marginTop: 10,
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
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    maxWidth: '80%',
  },
  projectPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1d4ed8',
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
    borderRadius: 999,
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
