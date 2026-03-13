import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api';
import { BaseMap } from '@/components/map';
import * as Location from 'expo-location';
import { HardHat, Trash2, Truck, Package, ChevronRight, Bell, Search } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  PROCESSING: 'Apstrādē',
  LOADING: 'Iekraušana',
  DISPATCHED: 'Nosūtīts',
  DELIVERING: 'Piegādē',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: '#9ca3af',
  CONFIRMED: '#111827',
  PROCESSING: '#374151',
  LOADING: '#374151',
  DISPATCHED: '#059669',
  DELIVERING: '#059669',
};

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    sub: 'Pasūtīt materiālus',
    route: '/order-request',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    sub: 'Iznomāt konteineru',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    sub: 'Nodot atkritumus',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    sub: 'Pierasīt pārvadājumu',
    route: '/transport',
  },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const TAB_H = 52;
const WIN_H = Dimensions.get('window').height;
const PEEK_H = 76; // only search bar stays visible when expanded

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const panelH = useRef(0);
  const dragY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const next = lastY.current + g.dy;
        dragY.setValue(Math.max(0, Math.min(panelH.current - PEEK_H, next)));
      },
      onPanResponderRelease: (_, g) => {
        const next = lastY.current + g.dy;
        const limit = panelH.current - PEEK_H;
        const snapTo = next > limit / 2 ? limit : 0;
        lastY.current = snapTo;
        Animated.spring(dragY, {
          toValue: snapTo,
          useNativeDriver: true,
          tension: 48,
          friction: 14,
        }).start();
      },
    }),
  ).current;
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);

  // Fly camera to user's current location once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      cameraRef.current?.setCamera({
        centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
        zoomLevel: 13,
        animationDuration: 900,
      });
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    api.orders
      .myOrders(token)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [token]);

  const activeOrder = orders?.find((o) => ACTIVE_STATUSES.has(o.status)) ?? null;
  const recentOrders = orders?.filter((o) => !ACTIVE_STATUSES.has(o.status)).slice(0, 3) ?? [];

  return (
    <View style={s.root}>
      {/* ── Full-screen map behind the panel ── */}
      <BaseMap cameraRef={cameraRef} zoom={12} showsUserLocation showsMyLocationButton />

      {/* ── Notification bell floating over map ── */}
      <TouchableOpacity
        style={s.bellFab}
        onPress={() => router.push('/notifications' as any)}
        activeOpacity={0.8}
      >
        <Bell size={20} color="#111827" />
      </TouchableOpacity>

      {/* ── Bottom sheet panel ── */}
      <Animated.View
        style={[s.panel, { transform: [{ translateY: dragY }] }]}
        onLayout={(e) => {
          panelH.current = e.nativeEvent.layout.height;
        }}
      >
        {/* Draggable header — search bar stays visible when map expanded */}
        <View style={s.dragHeader} {...pan.panHandlers}>
          <View style={s.handle} />
          <TouchableOpacity style={s.searchBar} activeOpacity={0.7} onPress={() => haptics.light()}>
            <Search size={18} color="#9ca3af" />
            <Text style={s.searchText}>Ko pasūtīt šodien?</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.panelScroll, { paddingBottom: TAB_H + insets.bottom }]}
          bounces={false}
        >
          {/* 2 × 2 service grid */}
          <View style={s.grid}>
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <TouchableOpacity
                  key={svc.id}
                  style={s.gridTile}
                  onPress={() => {
                    haptics.light();
                    router.push(svc.route as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={s.gridIcon}>
                    <Icon size={22} color="#111827" />
                  </View>
                  <Text style={s.gridLabel}>{svc.label}</Text>
                  <Text style={s.gridSub} numberOfLines={1}>
                    {svc.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active order banner */}
          {activeOrder && (
            <TouchableOpacity
              style={s.activeCard}
              onPress={() => router.push(`/(buyer)/order/${activeOrder.id}` as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  s.activeDot,
                  { backgroundColor: STATUS_DOT[activeOrder.status] ?? '#9ca3af' },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.activeLabel}>Aktīvs pasūtījums</Text>
                <Text style={s.activeNum}>#{activeOrder.orderNumber}</Text>
                <Text style={s.activeStatus}>
                  {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                </Text>
              </View>
              <ChevronRight size={18} color="#6b7280" />
            </TouchableOpacity>
          )}

          {/* Recent orders */}
          {recentOrders.length > 0 && (
            <View style={s.recentCard}>
              <View style={s.recentHeader}>
                <Text style={s.recentTitle}>Nesenie pasūtījumi</Text>
                <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
                  <Text style={s.recentCta}>Visi →</Text>
                </TouchableOpacity>
              </View>
              {recentOrders.map((o, i) => (
                <TouchableOpacity
                  key={o.id}
                  style={[s.recentRow, i < recentOrders.length - 1 && s.recentRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(buyer)/order/${o.id}` as any)}
                >
                  <View style={s.recentIcon}>
                    <Package size={13} color="#6b7280" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentNum}>#{o.orderNumber}</Text>
                    <Text style={s.recentCity} numberOfLines={1}>
                      {o.deliveryCity}
                    </Text>
                  </View>
                  <Text style={s.recentStatus}>{STATUS_LABEL[o.status] ?? o.status}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  bellFab: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 10,
    marginBottom: 4,
  },
  dragHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    marginTop: 6,
  },
  searchText: { fontSize: 15, color: '#9ca3af', fontWeight: '500', flex: 1 },
  panelScroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 14,
  },

  // 2×2 service grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  gridTile: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  gridLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  gridSub: { fontSize: 11, color: '#9ca3af', lineHeight: 15 },

  // Active order
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  activeLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', marginBottom: 1 },
  activeNum: { fontSize: 15, fontWeight: '700', color: '#111827' },
  activeStatus: { fontSize: 12, color: '#374151', marginTop: 1 },

  // Recent
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  recentCta: { fontSize: 12, color: '#111827', fontWeight: '600' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  recentIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentNum: { fontSize: 13, fontWeight: '600', color: '#111827' },
  recentCity: { fontSize: 11, color: '#9ca3af' },
  recentStatus: { fontSize: 11, color: '#6b7280' },
});
