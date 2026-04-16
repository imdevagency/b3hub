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
import { ScreenHeader } from '@/components/ui/ScreenHeader';

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
  const { unified, loading, refreshing, onRefresh: refresh, query, setQuery, error } = useOrders();

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
    () =>
      activeTab === 'active'
        ? unified.filter((i) => i.isActive)
        : unified.filter((i) => !i.isActive),
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
    <ScreenContainer bg="#F4F5F7">
      <ScreenHeader
        title="Pasūtījumi"
        showBack={false}
        noBorder
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              className="w-[40px] h-[40px] rounded-full bg-gray-700 items-center justify-center"
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                setShowSearch((v) => !v);
              }}
            >
              <Search size={20} color={showSearch ? '#00A878' : '#ffffff'} />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-[40px] h-[40px] rounded-full bg-gray-700 items-center justify-center"
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                router.push('/(buyer)/schedules' as any);
              }}
            >
              <Calendar size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-[40px] h-[40px] rounded-full bg-gray-700 items-center justify-center"
              activeOpacity={0.8}
              onPress={handleNewOrder}
            >
              <Plus size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Segmented Control ────────────────────────────────── */}
      <View className="px-4 pb-3 bg-gray-900">
        <View className="flex-row bg-gray-800 rounded-[10px] p-1">
          <TouchableOpacity
            className={`flex-1 py-[7px] rounded-lg items-center justify-center ${activeTab === 'active' ? 'bg-gray-700 shadow-sm' : ''}`}
            onPress={() => handleTabChange('active')}
            activeOpacity={0.8}
          >
            <Text
              className={`text-sm font-semibold ${activeTab === 'active' ? 'text-white' : 'text-gray-400'}`}
            >
              Aktīvie
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-[7px] rounded-lg items-center justify-center ${activeTab === 'done' ? 'bg-gray-700 shadow-sm' : ''}`}
            onPress={() => handleTabChange('done')}
            activeOpacity={0.8}
          >
            <Text
              className={`text-sm font-semibold ${activeTab === 'done' ? 'text-white' : 'text-gray-400'}`}
            >
              Vēsture
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Collapsible search + type filters ────────────────── */}
      {showSearch && (
        <View className="bg-white pb-2">
          <View
            className={`flex-row items-center mx-4 mb-2 px-3 py-2 rounded-xl border-[1.5px] ${searchFocused ? 'border-emerald-500 bg-white' : 'border-transparent bg-gray-100'}`}
          >
            <Search
              size={16}
              color={searchFocused ? '#00A878' : '#9ca3af'}
              style={{ marginRight: 8 }}
            />
            <TextInput
              className="flex-1 text-sm text-gray-900 py-0"
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
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setQuery('');
                }}
                hitSlop={8}
              >
                <X size={16} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          {hasMultipleKinds && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
            >
              <TypeChip
                label="Visi"
                count={kindCounts.all}
                active={kindFilter === 'all'}
                onPress={() => {
                  haptics.light();
                  setKindFilter('all');
                }}
              />
              {kindCounts.material > 0 && (
                <TypeChip
                  label="Materiāli"
                  count={kindCounts.material}
                  active={kindFilter === 'material'}
                  onPress={() => {
                    haptics.light();
                    setKindFilter('material');
                  }}
                />
              )}
              {kindCounts.logistics > 0 && (
                <TypeChip
                  label="Transports"
                  count={kindCounts.logistics}
                  active={kindFilter === 'logistics'}
                  onPress={() => {
                    haptics.light();
                    setKindFilter('logistics');
                  }}
                />
              )}
              {kindCounts.skip > 0 && (
                <TypeChip
                  label="Konteineri"
                  count={kindCounts.skip}
                  active={kindFilter === 'skip'}
                  onPress={() => {
                    haptics.light();
                    setKindFilter('skip');
                  }}
                />
              )}
              {kindCounts.rfq > 0 && (
                <TypeChip
                  label="RFQ"
                  count={kindCounts.rfq}
                  active={kindFilter === 'rfq'}
                  onPress={() => {
                    haptics.light();
                    setKindFilter('rfq');
                  }}
                />
              )}
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
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          showCo2Banner ? (
            <View className="bg-green-50 rounded-[20px] p-4 mb-4 border border-green-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Leaf size={18} color="#16a34a" fill="#16a34a" />
                <View>
                  <Text className="text-green-800 font-extrabold text-[15px] tracking-tight">
                    {formatCo2(totalCo2Kg)}
                  </Text>
                  <Text className="text-green-700 font-medium text-[11px]">
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
                  className="mt-6 bg-gray-900 px-6 py-3 rounded-[20px]"
                  onPress={() => refresh()}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-[15px]">Mēģināt vēlreiz</Text>
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
                  className="mt-6 bg-gray-900 px-6 py-3 rounded-[20px]"
                  onPress={handleNewOrder}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-[15px]">Jauns pasūtījums</Text>
                </TouchableOpacity>
              }
            />
          )
        }
      />

      {/* ── New Order Sheet ──────────────────────────────────── */}
      <BottomSheet visible={showTypePicker} onClose={() => setShowTypePicker(false)}>
        <View className="pb-10 pt-2">
          <Text className="text-2xl font-extrabold text-gray-900 mb-6 px-6 tracking-tight">
            Jauns pasūtījums
          </Text>

          <TouchableOpacity
            className="flex-row items-center px-6 py-3 gap-4"
            onPress={() => {
              haptics.light();
              setShowTypePicker(false);
              router.push('/(buyer)/catalog');
            }}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center">
              <HardHat size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View className="flex-1 justify-center gap-0.5">
              <Text className="text-[17px] font-bold text-gray-900">Materiāli</Text>
              <Text className="text-sm font-medium text-gray-500">Smiltis, šķembas, melnzeme</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-3 gap-4"
            onPress={() => {
              haptics.light();
              setShowTypePicker(false);
              router.push('/order');
            }}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center">
              <Package size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View className="flex-1 justify-center gap-0.5">
              <Text className="text-[17px] font-bold text-gray-900">Konteiners</Text>
              <Text className="text-sm font-medium text-gray-500">Konteiners uz vietas (noma)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-3 gap-4"
            onPress={() => {
              haptics.light();
              setShowTypePicker(false);
              router.push('/disposal');
            }}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center">
              <Trash2 size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View className="flex-1 justify-center gap-0.5">
              <Text className="text-[17px] font-bold text-gray-900">Utilizācija</Text>
              <Text className="text-sm font-medium text-gray-500">
                Atkritumu izvešana no objekta
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-3 gap-4"
            onPress={() => {
              haptics.light();
              setShowTypePicker(false);
              router.push('/order-request-new');
            }}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center">
              <FileText size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View className="flex-1 justify-center gap-0.5">
              <Text className="text-[17px] font-bold text-gray-900">Cenu aptauja (RFQ)</Text>
              <Text className="text-sm font-medium text-gray-500">
                Specifiski apjomi vai materiāli
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-6 py-3 gap-4"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/transport');
            }}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center">
              <Truck size={28} color="#111827" strokeWidth={1.5} />
            </View>
            <View className="flex-1 justify-center gap-0.5">
              <Text className="text-[17px] font-bold text-gray-900">Transports A → B</Text>
              <Text className="text-sm font-medium text-gray-500">Tikai pārvadājums</Text>
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
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${active ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-50 border-gray-200'}`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
        {label}
      </Text>
      <View
        className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${active ? 'bg-emerald-600' : 'bg-gray-200'}`}
      >
        <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-gray-500'}`}>
          {count}
        </Text>
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
      className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100 shadow-sm"
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/order/${order.id}`)}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
          <Package size={16} color="#64748b" />
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Materiāli
          </Text>
          <Text className="text-xs font-medium text-gray-400">· #{order.orderNumber}</Text>
        </View>
        <StatusPill
          label={formatStatus(order.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text
        className="text-gray-900 font-black text-xl tracking-tight mb-2 leading-tight"
        numberOfLines={2}
      >
        {displayTitle}
      </Text>

      {order.project?.name && (
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <View className="flex-row items-center gap-1.5 bg-blue-50/50 border border-blue-100 px-2.5 py-1 rounded-full max-w-[80%]">
            <HardHat size={11} color="#1d4ed8" />
            <Text className="text-[11px] font-bold text-blue-700" numberOfLines={1}>
              {order.project.name}
            </Text>
          </View>
        </View>
      )}

      <View className="gap-2 mb-3 mt-1">
        <View className="flex-row items-center gap-2">
          <MapPin size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1" numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Calendar size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            {order.deliveryDate
              ? format(new Date(order.deliveryDate), 'd. MMM', { locale: lv })
              : 'Cik drīz iespējams'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
        <View className="gap-1">
          <Text className="text-gray-900 font-black text-[22px]">
            {order.totalAmount != null ? `€${order.totalAmount}` : '—'}
          </Text>
          <PaymentBadge status={order.paymentStatus} />
        </View>
        <View className="flex-row items-center gap-3">
          {order.linkedSkipOrder && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full"
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(buyer)/skip-order/${order.linkedSkipOrder.id}` as any);
              }}
              activeOpacity={0.8}
            >
              <Link2 size={11} color="#059669" />
              <Text className="text-emerald-700 font-bold text-xs">Konteiners</Text>
            </TouchableOpacity>
          )}
          {activeJob && driverName && (
            <Text className="text-gray-600 font-semibold text-sm">{driverName}</Text>
          )}
          {activeJob && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-green-500 px-3 py-1.5 rounded-full shadow-sm shadow-green-500/20"
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(buyer)/transport-job/${activeJob.id}` as any);
              }}
              activeOpacity={0.8}
            >
              <View className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <Text className="text-white font-bold text-[13px]">Live</Text>
            </TouchableOpacity>
          )}
          <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
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
      className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100 shadow-sm"
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/transport-job/${req.id}`)}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
          <Trash2 size={16} color="#64748b" />
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Utilizācija
          </Text>
        </View>
        <StatusPill
          label={formatStatus(req.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text
        className="text-gray-900 font-black text-xl tracking-tight mb-2 leading-tight"
        numberOfLines={2}
      >
        {(req.pickupAddress ?? '').split(',')[0] || 'Izvešanas vieta'}
      </Text>

      <View className="gap-2 mb-3 mt-1">
        <View className="flex-row items-center gap-2">
          <MapPin size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1" numberOfLines={1}>
            Atkritumu izvešana
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Calendar size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            {req.pickupDate
              ? format(new Date(req.pickupDate), 'd. MMM', { locale: lv })
              : 'Pēc vienošanās'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
        {req.rate != null ? (
          <Text className="text-gray-900 font-black text-[22px]">€{req.rate}</Text>
        ) : (
          <Text className="text-gray-400 text-sm font-semibold self-center">Tiks precizēts</Text>
        )}
        <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
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
      className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100 shadow-sm"
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/transport-job/${req.id}`)}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
          <Truck size={16} color="#64748b" />
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Transports
          </Text>
        </View>
        <StatusPill
          label={formatStatus(req.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text
        className="text-gray-900 font-black text-xl tracking-tight mb-2 leading-tight"
        numberOfLines={2}
      >
        {(req.pickupAddress ?? '').split(',')[0] || 'Iekraušana'} →{' '}
        {(req.deliveryAddress ?? '').split(',')[0] || 'Piegāde'}
      </Text>

      <View className="gap-2 mb-3 mt-1">
        <View className="flex-row items-center gap-2">
          <Clock size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            {req.pickupDate
              ? format(new Date(req.pickupDate), 'd. MMM HH:mm', { locale: lv })
              : 'Pēc vienošanās'}
          </Text>
        </View>
      </View>

      {/* Spacer to align footer height if needed, or remove if content adjusts */}
      <View className="flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
        {req.rate != null && req.rate > 0 ? (
          <Text className="text-gray-900 font-black text-[22px]">no €{req.rate}</Text>
        ) : (
          <Text className="text-gray-400 text-sm font-semibold self-center">Tiks precizēts</Text>
        )}
        <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
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
      className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100 shadow-sm"
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/rfq/${rfq.id}`)}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
          <FileText size={16} color="#64748b" />
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Cenu aptauja
          </Text>
        </View>
        <StatusPill
          label={formatStatus(rfq.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text
        className="text-gray-900 font-black text-xl tracking-tight mb-2 leading-tight"
        numberOfLines={2}
      >
        {rfq.title || 'Jauna cenu aptauja'}
      </Text>

      <View className="gap-2 mb-3 mt-1">
        <View className="flex-row items-center gap-2">
          <AlertCircle size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            {rfq._count?.quotes || 0} piedāvājumi
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Calendar size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            Termiņš:{' '}
            {rfq.deadline
              ? format(new Date(rfq.deadline), 'd. MMM', { locale: lv })
              : 'Nav termiņa'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
        <Text className="text-gray-900 font-black text-[22px]">RFQ</Text>
        <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
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
      className="bg-white rounded-[24px] p-5 mb-4 border border-gray-100 shadow-sm"
      activeOpacity={0.9}
      onPress={() => router.push(`/(buyer)/skip-order/${order.id}`)}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
          <Package size={16} color="#64748b" />
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Konteiners
          </Text>
          <Text className="text-xs font-medium text-gray-400"> · #{order.orderNumber}</Text>
        </View>
        <StatusPill
          label={formatStatus(order.status)}
          bg={statusColors.bg}
          color={statusColors.text}
          size="sm"
        />
      </View>

      <Text
        className="text-gray-900 font-black text-xl tracking-tight mb-2 leading-tight"
        numberOfLines={2}
      >
        {SIZE_LABEL[order.skipSize as string] ?? order.skipSize}
      </Text>

      <View className="gap-2 mb-3 mt-1">
        <View className="flex-row items-center gap-2">
          <MapPin size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1" numberOfLines={1}>
            {order.location}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Calendar size={14} color="#94a3b8" />
          <Text className="text-gray-500 font-medium text-[15px] flex-1">
            {order.deliveryDate
              ? format(new Date(order.deliveryDate), 'd. MMM', { locale: lv })
              : 'Nav datuma'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-end mt-4 pt-4 border-t border-gray-100">
        {order.price != null ? (
          <Text className="text-gray-900 font-black text-[22px]">€{order.price.toFixed(2)}</Text>
        ) : (
          <Text className="text-gray-400 text-sm font-semibold self-center mb-0.5">Gaida cenu</Text>
        )}
        <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
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
