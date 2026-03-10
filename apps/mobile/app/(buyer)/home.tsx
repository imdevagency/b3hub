import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api';
import { t } from '@/lib/translations';
import { HardHat, Trash2, Truck, ChevronRight, Package, Bell } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { Skeleton, SkeletonHome } from '@/components/ui/Skeleton';

// ── Types ───────────────────────────────────────────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

interface ServiceTile {
  id: string;
  icon: LucideIcon;
  label: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  route: string;
}

// ── Constants ───────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprīnāšanu',
  CONFIRMED: 'Apstiprināts',
  PROCESSING: 'Apstrādē',
  LOADING: 'Iekraušana',
  DISPATCHED: 'Nosūtīts',
  DELIVERING: 'Piegādē',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: '#6b7280',
  CONFIRMED: '#111827',
  PROCESSING: '#111827',
  LOADING: '#374151',
  DISPATCHED: '#111827',
  DELIVERING: '#111827',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED: { bg: '#f3f4f6', color: '#374151' },
  PROCESSING: { bg: '#f3f4f6', color: '#374151' },
  LOADING: { bg: '#f3f4f6', color: '#374151' },
  DISPATCHED: { bg: '#dcfce7', color: '#15803d' },
  DELIVERING: { bg: '#dcfce7', color: '#15803d' },
  DELIVERED: { bg: '#f0fdf4', color: '#15803d' },
  COMPLETED: { bg: '#f0fdf4', color: '#15803d' },
  CANCELLED: { bg: '#fee2e2', color: '#b91c1c' },
};

const SERVICE_TILES: ServiceTile[] = [
  {
    id: 'materials',
    icon: HardHat,
    label: t.home.services.materials,
    bg: '#f3f4f6',
    iconBg: '#f3f4f6',
    iconColor: '#374151',
    route: '/order-request',
  },
  {
    id: 'container',
    icon: Trash2,
    label: t.home.services.container,
    bg: '#f0fdf4',
    iconBg: '#bbf7d0',
    iconColor: '#15803d',
    route: '/order',
  },
  {
    id: 'freight',
    icon: Truck,
    label: t.home.services.freight,
    bg: '#f3f4f6',
    iconBg: '#f3f4f6',
    iconColor: '#374151',
    route: '/order-request',
  },
];

// ── Time-based greeting ──────────────────────────────────────────────────────────────────────

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

// ── Skeleton pulse ──────────────────────────────────────────────────────────────────

function SkeletonBox({
  width,
  height = 16,
  style,
}: {
  width: number | string;
  height?: number;
  style?: object;
}) {
  const anim = React.useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#e5e7eb',
          borderRadius: 6,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────────────────

// ── Market demand strip ───────────────────────────────────────────────────────────────
// Time-of-day demand indicator so buyers feel marketplace urgency.
function DemandStrip() {
  const h = new Date().getHours();
  const isHighDemand = (h >= 7 && h < 10) || (h >= 14 && h < 18);
  const isMediumDemand = !isHighDemand && h >= 10 && h < 20;
  const activeDrivers = isHighDemand ? 10 + (h % 5) : isMediumDemand ? 5 + (h % 4) : 3;

  const dotColor = isHighDemand ? '#059669' : isMediumDemand ? '#d97706' : '#9ca3af';
  const bg = isHighDemand ? '#f0fdf4' : isMediumDemand ? '#fffbeb' : '#f9fafb';
  const borderColor = isHighDemand ? '#bbf7d0' : isMediumDemand ? '#fde68a' : '#f3f4f6';
  const textColor = isHighDemand ? '#065f46' : isMediumDemand ? '#92400e' : '#6b7280';
  const label = isHighDemand
    ? 'Augsts pieprasījums'
    : isMediumDemand
      ? 'Vidējs pieprasījums'
      : 'Mierīgs tirgus';

  return (
    <View style={[s.demandStrip, { backgroundColor: bg, borderColor }]}>
      <View style={[s.demandDot, { backgroundColor: dotColor }]} />
      <Text style={[s.demandLabel, { color: textColor }]}>{label}</Text>
      <Text style={s.demandSub}>· {activeDrivers} šoferī aktīvi</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const greeting = timeGreeting();
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.orders
      .myOrders(token)
      .then((data) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  const activeOrder = orders?.find((o) => ACTIVE_STATUSES.has(o.status)) ?? null;
  const recentOrders = orders?.filter((o) => !ACTIVE_STATUSES.has(o.status)).slice(0, 3) ?? [];
  const isPartnerEligible = !user?.canSell && !user?.canTransport;

  return (
    <ScreenContainer bg="#f9fafb">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.headerGreeting}>{greeting}</Text>
            <Text style={s.headerName}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <Bell size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          {/* ── Market demand strip ── */}
          <DemandStrip />

          {/* ── Service tiles ── */}
          <View style={s.tilesRow}>
            {SERVICE_TILES.slice(0, 2).map((tile) => {
              const Icon = tile.icon;
              return (
                <TouchableOpacity
                  key={tile.id}
                  style={[s.tile, { backgroundColor: tile.bg }]}
                  activeOpacity={0.75}
                  onPress={() => {
                    haptics.light();
                    router.push(tile.route as any);
                  }}
                >
                  <View style={[s.tileIcon, { backgroundColor: tile.iconBg }]}>
                    <Icon size={22} color={tile.iconColor} />
                  </View>
                  <Text style={s.tileLabel}>{tile.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {(() => {
            const tile = SERVICE_TILES[2];
            const Icon = tile.icon;
            return (
              <TouchableOpacity
                style={[s.tileFull, { backgroundColor: tile.bg }]}
                activeOpacity={0.75}
                onPress={() => {
                  haptics.light();
                  router.push(tile.route as any);
                }}
              >
                <View style={[s.tileIcon, { backgroundColor: tile.iconBg }]}>
                  <Icon size={22} color={tile.iconColor} />
                </View>
                <Text style={[s.tileLabel, s.tileFullLabel]}>{tile.label}</Text>
                <ChevronRight size={16} color="#9ca3af" />
              </TouchableOpacity>
            );
          })()}

          {/* ── Active order ── */}
          {loading ? (
            <View style={s.card}>
              <Skeleton width={140} height={12} style={{ marginBottom: 14 }} />
              <Skeleton width="100%" height={22} style={{ marginBottom: 8 }} />
              <Skeleton width="55%" height={12} />
            </View>
          ) : activeOrder ? (
            <TouchableOpacity
              style={[s.card, s.activeOrderCard]}
              activeOpacity={0.8}
              onPress={() => router.push(`/(buyer)/order/${activeOrder.id}` as any)}
            >
              <View style={s.activeOrderHeader}>
                <View
                  style={[
                    s.statusDot,
                    { backgroundColor: STATUS_DOT[activeOrder.status] ?? '#6b7280' },
                  ]}
                />
                <Text style={s.activeOrderStatus}>
                  {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                </Text>
                <Text style={s.activeOrderTrack}>{t.home.trackOrder}</Text>
              </View>
              <Text style={s.activeOrderNum}>#{activeOrder.orderNumber}</Text>
              <Text style={s.activeOrderAddr} numberOfLines={1}>
                {activeOrder.deliveryAddress}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* ── Recent orders ── */}
          {!loading && recentOrders.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>{t.home.recentOrders}</Text>
                <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
                  <Text style={s.cardCta}>{t.home.allOrders}</Text>
                </TouchableOpacity>
              </View>
              {recentOrders.map((o, i) => (
                <TouchableOpacity
                  key={o.id}
                  style={[s.orderRow, i < recentOrders.length - 1 && s.orderRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(buyer)/order/${o.id}` as any)}
                >
                  <View style={s.orderRowIcon}>
                    <Package size={14} color="#6b7280" />
                  </View>
                  <View style={s.orderRowBody}>
                    <Text style={s.orderRowNum}>#{o.orderNumber}</Text>
                    <Text style={s.orderRowAddr} numberOfLines={1}>
                      {o.deliveryCity}
                    </Text>
                  </View>
                  {(() => {
                    const badge = STATUS_BADGE[o.status];
                    return badge ? (
                      <View style={[s.orderStatusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.orderStatusBadgeText, { color: badge.color }]}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Text>
                      </View>
                    ) : (
                      <Text style={s.orderRowStatus}>{STATUS_LABEL[o.status] ?? o.status}</Text>
                    );
                  })()}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Become a partner ── */}
          {isPartnerEligible && (
            <View style={s.partnerSection}>
              <Text style={s.partnerSectionTitle}>Pelni ar B3Hub</Text>
              <View style={s.partnerRow}>
                <TouchableOpacity
                  style={[s.partnerCard, { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }]}
                  activeOpacity={0.82}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/apply-role',
                      params: { type: 'supplier' },
                    } as any)
                  }
                >
                  <View style={[s.partnerCardIcon, { backgroundColor: '#a7f3d0' }]}>
                    <Package size={18} color="#059669" />
                  </View>
                  <Text style={[s.partnerCardTitle, { color: '#059669' }]}>Piegādātājs</Text>
                  <Text style={s.partnerCardDesc}>Pārdod materiālus tīklā</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.partnerCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                  activeOpacity={0.82}
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/apply-role',
                      params: { type: 'carrier' },
                    } as any)
                  }
                >
                  <View style={[s.partnerCardIcon, { backgroundColor: '#bfdbfe' }]}>
                    <Truck size={18} color="#1d4ed8" />
                  </View>
                  <Text style={[s.partnerCardTitle, { color: '#1d4ed8' }]}>Pārvadātājs</Text>
                  <Text style={s.partnerCardDesc}>Nopelni uz katru kravu</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerGreeting: { color: '#fca5a5', fontSize: 13 },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  body: { paddingHorizontal: 16, marginTop: -20, gap: 12, paddingBottom: 32 },

  // Demand strip
  demandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  demandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  demandLabel: { fontSize: 13, fontWeight: '700' },
  demandSub: { fontSize: 12, color: '#9ca3af' },

  // Tiles
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    minHeight: 100,
    justifyContent: 'center',
  },
  tileFull: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 17 },
  tileFullLabel: { flex: 1 },

  // Card base
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardCta: { fontSize: 12, color: '#111827', fontWeight: '600' },

  // Active order
  activeOrderCard: { borderLeftWidth: 3, borderLeftColor: '#111827' },
  activeOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  activeOrderStatus: { fontSize: 12, fontWeight: '600', color: '#374151', flex: 1 },
  activeOrderTrack: { fontSize: 12, color: '#111827', fontWeight: '600' },
  activeOrderNum: { fontSize: 16, fontWeight: '700', color: '#111827' },
  activeOrderAddr: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Recent orders
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  orderRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  orderRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderRowBody: { flex: 1 },
  orderRowNum: { fontSize: 13, fontWeight: '600', color: '#111827' },
  orderRowAddr: { fontSize: 11, color: '#9ca3af' },
  orderRowStatus: { fontSize: 11, color: '#6b7280' },
  orderStatusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  orderStatusBadgeText: { fontSize: 11, fontWeight: '600' },

  // Partner section
  partnerSection: { marginBottom: 8 },
  partnerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  partnerRow: { flexDirection: 'row', gap: 10 },
  partnerCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  partnerCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  partnerCardTitle: { fontSize: 14, fontWeight: '700' },
  partnerCardDesc: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
});
