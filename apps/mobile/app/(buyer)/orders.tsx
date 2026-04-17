import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Plus,
  Package,
  Truck,
  FileText,
  ChevronRight,
  Trash2,
  Search,
  X,
  HardHat,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { useOrders, UnifiedOrder } from '@/lib/use-orders';
import type { ApiOrder, ApiTransportJob, SkipHireOrder, QuoteRequest } from '@/lib/api';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { haptics } from '@/lib/haptics';
import { Divider } from '@/components/ui/Divider';
import { SIZE_LABEL } from '@/lib/materials';

export default function OrdersScreen() {
  const router = useRouter();
  const { unified, loading, refreshing, onRefresh: refresh, query, setQuery, error } = useOrders();

  const [activeTab, setActiveTab] = useState<'active' | 'done'>('active');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const tabFiltered = React.useMemo(
    () =>
      activeTab === 'active'
        ? unified.filter((i) => i.isActive)
        : unified.filter((i) => !i.isActive),
    [unified, activeTab],
  );

  const displayItems = React.useMemo(() => {
    let base = tabFiltered;
    if (query.trim().length >= 2) {
      const q = query.trim().toLowerCase();
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
        return parts.join(' ').toLowerCase().includes(q);
      });
    }
    return base;
  }, [tabFiltered, query]);

  const handleTabChange = (tab: 'active' | 'done') => {
    if (activeTab === tab) return;
    haptics.light();
    setActiveTab(tab);
  };

  const renderItem = useCallback(({ item }: { item: UnifiedOrder }) => {
    switch (item.kind) {
      case 'material':
        return <MaterialRow item={item.data} />;
      case 'transport':
        return <TransportRow item={item.data} />;
      case 'disposal':
        return <DisposalRow item={item.data} />;
      case 'rfq':
        return <RfqRow item={item.data} />;
      case 'skip':
        return <SkipRow item={item.data} />;
      default:
        return null;
    }
  }, []);

  return (
    <ScreenContainer bg="#FFFFFF">
      {/* ── Header / Search takeover ──────────────────────────── */}
      {showSearch ? (
        <View className="flex-row items-center px-4 pt-2 pb-2 bg-white">
          <View className="flex-1 flex-row items-center px-3 py-2.5 rounded-xl bg-gray-100">
            <Search size={18} color="#9ca3af" />
            <TextInput
              className="flex-1 ml-2 text-gray-900 py-0"
              style={{ fontSize: 16 }}
              placeholder="Meklēt..."
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              clearButtonMode="never"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <X size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowSearch(false);
              setQuery('');
            }}
            className="ml-4"
          >
            <Text className="text-gray-900 font-semibold" style={{ fontSize: 16 }}>
              Atcelt
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScreenHeader
          title="Aktivitāte"
          showBack={false}
          noBorder
          rightAction={
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  haptics.light();
                  setShowSearch(true);
                }}
              >
                <Search size={24} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  haptics.light();
                  setShowTypePicker(true);
                }}
              >
                <Plus size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Segmented Control (Minimal) ───────────────────────── */}
      <View className="flex-row px-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => handleTabChange('active')}
          className={`mr-6 py-3 border-b-2 ${activeTab === 'active' ? 'border-gray-900' : 'border-transparent'}`}
        >
          <Text
            className={`font-semibold ${activeTab === 'active' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            Aktīvie
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange('done')}
          className={`py-3 border-b-2 ${activeTab === 'done' ? 'border-gray-900' : 'border-transparent'}`}
        >
          <Text
            className={`font-semibold ${activeTab === 'done' ? 'text-gray-900' : 'text-gray-400'}`}
          >
            Vēsture
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── List ─────────────────────────────────────────────── */}
      <FlatList
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        data={displayItems}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View className="h-[1px] bg-gray-100" style={{ marginLeft: 76 }} />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#111827" />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={{ padding: 16, gap: 16 }}>
              <SkeletonCard count={3} />
            </View>
          ) : (
            <EmptyState
              icon={<Search size={32} color="#d1d5db" />}
              title={query ? 'Nekas netika atrasts' : 'Nav pasūtījumu'}
              subtitle={query ? 'Pamēģiniet citu atslēgvārdu.' : 'Jums vēl nav neviena pasūtījuma.'}
            />
          )
        }
      />

      {/* ── Minimal Order Sheet ──────────────────────────────── */}
      <BottomSheet visible={showTypePicker} onClose={() => setShowTypePicker(false)}>
        <View className="pb-10 pt-2 px-2">
          <Text className="text-xl font-bold text-gray-900 mb-6 px-4">Ko pasūtīsiet?</Text>

          <SheetRow
            icon={<Package size={22} color="#111827" />}
            title="Materiāli"
            subtitle="Piegāde uz objektu"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/(buyer)/catalog');
            }}
          />
          <SheetRow
            icon={<HardHat size={22} color="#111827" />}
            title="Konteiners"
            subtitle="Noma un izvešana"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order');
            }}
          />
          <SheetRow
            icon={<Trash2 size={22} color="#111827" />}
            title="Utilizācija"
            subtitle="Būvgružu izvešana"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/disposal');
            }}
          />
          <SheetRow
            icon={<Truck size={22} color="#111827" />}
            title="Transports"
            subtitle="Tehnikas pārvadājumi"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/transport');
            }}
          />
          <SheetRow
            icon={<FileText size={22} color="#111827" />}
            title="Cenu aptauja"
            subtitle="Saņemiet piedāvājumus"
            onPress={() => {
              setShowTypePicker(false);
              router.push('/order-request-new');
            }}
          />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

// ── Components ────────────────────────────────────────────────

function SheetRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 active:bg-gray-50 rounded-xl mx-2"
      onPress={onPress}
    >
      <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-4">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-gray-900" style={{ fontSize: 16 }}>
          {title}
        </Text>
        <Text className="text-gray-500 mt-0.5" style={{ fontSize: 14 }}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function UniversalRow({
  icon,
  title,
  subtitleLines,
  price,
  statusColor,
  statusText,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitleLines: string[];
  price: string;
  statusColor: string;
  statusText: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-4 pr-5 pl-4 active:bg-gray-50 bg-white"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center mr-4">
        {icon}
      </View>

      <View className="flex-1 justify-center py-1">
        <Text
          className="font-semibold text-gray-900 mb-1"
          style={{ fontSize: 16 }}
          numberOfLines={1}
        >
          {title}
        </Text>

        {subtitleLines.map((line: string, i: number) => (
          <Text key={i} className="text-gray-500 mb-0.5" style={{ fontSize: 14 }} numberOfLines={1}>
            {line}
          </Text>
        ))}

        {statusText && (
          <Text className="font-medium" style={{ fontSize: 14, color: statusColor }}>
            {statusText}
          </Text>
        )}
      </View>

      <View className="items-end justify-center ml-3">
        {price ? (
          <Text className="font-semibold text-gray-900 mb-1" style={{ fontSize: 15 }}>
            {price}
          </Text>
        ) : null}
        <View className="w-6 h-6 items-end justify-center">
          <ChevronRight size={18} color="#d1d5db" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Helpers for Rows ──────────────────────────────────────────

const DRIVER_TRANSIT_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

function getStatusStyle(status: string) {
  switch (status) {
    case 'IN_PROGRESS':
    case 'ACCEPTED':
    case 'CONFIRMED':
      return { color: '#059669', label: 'Izpildē' };
    case 'DELIVERED':
    case 'COMPLETED':
      return { color: '#6b7280', label: 'Pabeigts' };
    case 'PENDING':
    case 'OPEN':
    case 'SUBMITTED':
      return { color: '#d97706', label: 'Gaida' };
    case 'CANCELLED':
    case 'REJECTED':
      return { color: '#dc2626', label: 'Atcelts' };
    default:
      return { color: '#6b7280', label: status };
  }
}

// ── Specialized Rows ──────────────────────────────────────────

function MaterialRow({ item }: { item: ApiOrder }) {
  const router = useRouter();
  const st = getStatusStyle(item.status);

  const itemsCount = item.items?.length || 0;
  const firstItemName = item.items?.[0]?.material?.name || 'Materiāli';
  const title = itemsCount > 1 ? `${firstItemName} +${itemsCount - 1}` : firstItemName;

  const address = item.deliveryAddress?.split(',')[0] || 'Nav adreses';
  const dateStr = item.deliveryDate
    ? format(new Date(item.deliveryDate), 'd. MMM', { locale: lv })
    : '';
  const price = item.total != null ? `€${item.total}` : '';

  // Highlight if driver is en route
  const activeJob = item.transportJobs?.find((j) => DRIVER_TRANSIT_STATUSES.has(j.status));
  const statusText = activeJob ? 'Ceļā' : st.label;
  const statusColor = activeJob ? '#059669' : st.color;

  return (
    <UniversalRow
      icon={<Package size={20} color="#374151" />}
      title={title}
      subtitleLines={[address, dateStr].filter(Boolean)}
      price={price}
      statusColor={statusColor}
      statusText={statusText}
      onPress={() => router.push(`/(buyer)/order/${item.id}`)}
    />
  );
}

function TransportRow({ item }: { item: ApiTransportJob }) {
  const router = useRouter();
  const st = getStatusStyle(item.status);

  const title =
    (item.pickupAddress?.split(',')[0] || 'Iekraušana') +
    ' → ' +
    (item.deliveryAddress?.split(',')[0] || 'Piegāde');
  const dateStr = item.pickupDate
    ? format(new Date(item.pickupDate), 'd. MMM HH:mm', { locale: lv })
    : '';
  const price = item.rate != null ? `€${item.rate}` : '';

  return (
    <UniversalRow
      icon={<Truck size={20} color="#374151" />}
      title={title}
      subtitleLines={[dateStr].filter(Boolean)}
      price={price}
      statusColor={st.color}
      statusText={st.label}
      onPress={() => router.push(`/(buyer)/transport-job/${item.id}`)}
    />
  );
}

function DisposalRow({ item }: { item: ApiTransportJob }) {
  const router = useRouter();
  const st = getStatusStyle(item.status);

  const title = 'Atkritumu izvešana';
  const address = item.pickupAddress?.split(',')[0] || '';
  const dateStr = item.pickupDate
    ? format(new Date(item.pickupDate), 'd. MMM', { locale: lv })
    : '';
  const price = item.rate != null ? `€${item.rate}` : '';

  return (
    <UniversalRow
      icon={<Trash2 size={20} color="#374151" />}
      title={title}
      subtitleLines={[address, dateStr].filter(Boolean)}
      price={price}
      statusColor={st.color}
      statusText={st.label}
      onPress={() => router.push(`/(buyer)/transport-job/${item.id}`)}
    />
  );
}

function SkipRow({ item }: { item: SkipHireOrder }) {
  const router = useRouter();
  const st = getStatusStyle(item.status);

  const size = SIZE_LABEL[item.skipSize as string] ?? item.skipSize;
  const title = `Konteiners ${size}`;
  const address = item.location?.split(',')[0] || '';
  const dateStr = item.deliveryDate
    ? format(new Date(item.deliveryDate), 'd. MMM', { locale: lv })
    : '';
  const price = item.price != null ? `€${item.price.toFixed(2)}` : '';

  return (
    <UniversalRow
      icon={<HardHat size={20} color="#374151" />}
      title={title}
      subtitleLines={[address, dateStr].filter(Boolean)}
      price={price}
      statusColor={st.color}
      statusText={st.label}
      onPress={() => router.push(`/(buyer)/skip-order/${item.id}`)}
    />
  );
}

function RfqRow({ item }: { item: QuoteRequest }) {
  const router = useRouter();
  const st = getStatusStyle(item.status);

  const title = item.materialName || 'Cenu aptauja';
  const quotes = `${item.responses?.length || 0} piedāvājumi`;
  const dateStr = item.createdAt
    ? `Izveidots: ${format(new Date(item.createdAt), 'd. MMM', { locale: lv })}`
    : '';

  return (
    <UniversalRow
      icon={<FileText size={20} color="#374151" />}
      title={title}
      subtitleLines={[quotes, dateStr].filter(Boolean)}
      price=""
      statusColor={st.color}
      statusText={st.label}
      onPress={() => router.push(`/(buyer)/rfq/${item.id}`)}
    />
  );
}
