import React, { useState, useCallback, useEffect } from 'react';
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
  Leaf,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { useOrders, type FilterKey } from '@/lib/use-orders';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { type ApiOrderSchedule } from '@/lib/api/orders';
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
    filtered,
    unified,
    loading,
    refreshing,
    onRefresh: refresh,
    filter,
    setFilter,
    query,
    setQuery,
    error,
  } = useOrders();

  const { token } = useAuth();
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSchedulesSheet, setShowSchedulesSheet] = useState(false);
  const [schedules, setSchedules] = useState<ApiOrderSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!token) return;
    setSchedulesLoading(true);
    try {
      const data = await api.schedules.list(token);
      setSchedules(data);
    } catch {
      // ignore
    } finally {
      setSchedulesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (showSchedulesSheet) loadSchedules();
  }, [showSchedulesSheet, loadSchedules]);

  const handleSchedulePause = async (id: string) => {
    if (!token) return;
    haptics.light();
    await api.schedules.pause(id, token);
    await loadSchedules();
  };

  const handleScheduleResume = async (id: string) => {
    if (!token) return;
    haptics.light();
    await api.schedules.resume(id, token);
    await loadSchedules();
  };

  const handleScheduleDelete = async (id: string) => {
    if (!token) return;
    haptics.medium();
    await api.schedules.delete(id, token);
    await loadSchedules();
  };

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

  const handleFilterChange = (key: FilterKey) => {
    haptics.light();
    setFilter(key);
  };

  const handleNewOrder = () => {
    haptics.light();
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
    <ScreenContainer bg="#ffffff">
      {/* ── Header ───────────────────────────────────────────── */}
      <ScreenHeader
        title="Pasūtījumi"
        onBack={null}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                setShowSchedulesSheet(true);
              }}
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
              <Calendar size={22} color="#111827" />
            </TouchableOpacity>
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
          </View>
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

      {/* ── Schedules Sheet ──────────────────────────────────── */}
      <BottomSheet visible={showSchedulesSheet} onClose={() => setShowSchedulesSheet(false)}>
        <View style={s.sheetContent}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <Text style={s.sheetTitle}>Atkārtoti pasūtījumi</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                setShowSchedulesSheet(false);
                router.push('/(buyer)/catalog?schedule=1' as any);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#111827',
              }}
            >
              <Plus size={14} color="#fff" />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                Jauns
              </Text>
            </TouchableOpacity>
          </View>
          {schedulesLoading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={80} radius={12} />
              <Skeleton height={80} radius={12} />
            </View>
          ) : schedules.length === 0 ? (
            <EmptyState
              icon={<Calendar size={32} color="#d1d5db" />}
              title="Nav atkārtotu pasūtījumu"
              subtitle="Izveidojiet pasūtījumu un izvēlieties atkārtošanas biežumu"
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {schedules.map((sched) => (
                <ScheduleRow
                  key={sched.id}
                  schedule={sched}
                  onPause={() => handleSchedulePause(sched.id)}
                  onResume={() => handleScheduleResume(sched.id)}
                  onDelete={() => handleScheduleDelete(sched.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </BottomSheet>

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

const INTERVAL_LABELS: Record<number, string> = {
  1: 'Katru dienu',
  7: 'Katru nedēļu',
  14: 'Katru 2 nedēļas',
  30: 'Katru mēnesi',
};

function ScheduleRow({
  schedule,
  onPause,
  onResume,
  onDelete,
}: {
  schedule: ApiOrderSchedule;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}) {
  const intervalLabel =
    INTERVAL_LABELS[schedule.intervalDays] ?? `Ik ${schedule.intervalDays} dienas`;
  const nextDate = schedule.nextRunAt
    ? format(new Date(schedule.nextRunAt), 'd. MMM yyyy', { locale: lv })
    : '—';

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        backgroundColor: schedule.enabled ? '#ffffff' : '#f9fafb',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <Text
          style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827', flex: 1 }}
          numberOfLines={1}
        >
          {schedule.deliveryCity || schedule.deliveryAddress}
        </Text>
        <StatusPill
          label={schedule.enabled ? 'Aktīvs' : 'Pauzēts'}
          bg={schedule.enabled ? '#dcfce7' : '#f3f4f6'}
          color={schedule.enabled ? '#166534' : '#6b7280'}
          size="sm"
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} color="#9ca3af" />
          <Text style={{ fontSize: 12, color: '#6b7280' }}>{intervalLabel}</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#9ca3af' }}>·</Text>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>Nākamais: {nextDate}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={schedule.enabled ? onPause : onResume}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#d1d5db',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151' }}>
            {schedule.enabled ? 'Pauzēt' : 'Atsākt'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onDelete}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#fca5a5',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#dc2626' }}>
            Dzēst
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
        <Text style={s.price}>{order.price != null ? `€${order.price.toFixed(2)}` : '—'}</Text>
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
    backgroundColor: '#f9fafb',
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
