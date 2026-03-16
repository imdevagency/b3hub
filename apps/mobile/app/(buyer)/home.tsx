import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api';
import { BaseMap, useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import * as Location from 'expo-location';
import {
  HardHat,
  Trash2,
  Truck,
  Package,
  ChevronRight,
  ChevronLeft,
  Search,
  Bell,
  X,
  MapPin,
} from 'lucide-react-native';
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
    route: '/order-request',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
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
const HEADER_H = 92; // drag handle + search bar height

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const panelH = useRef(0);
  const dragY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const scrollTop = useRef(true);
  const insetsTopRef = useRef(insets.top);
  // keep insetsTopRef current so the stale PanResponder closure can read it
  insetsTopRef.current = insets.top;

  // Compute the three snap offsets from panel top
  // [0] full = panel fully up
  // [1] peek = ~half the panel visible (default start)
  // [2] mini = only handle+searchbar visible
  const getSnaps = (): [number, number, number] => {
    const h = panelH.current;
    return [0, Math.round(h * 0.48), h - HEADER_H];
  };

  const pan = useRef(
    PanResponder.create({
      // Capture gesture when: header always, scroll content only when at top scrolling down
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 5 && (scrollTop.current ? true : g.dy < -6),
      onPanResponderGrant: () => {
        // Freeze animation and capture current position
        (dragY as any).stopAnimation((v: number) => {
          lastY.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const [, , mini] = getSnaps();
        const next = lastY.current + g.dy;
        dragY.setValue(Math.max(0, Math.min(mini, next)));
      },
      onPanResponderRelease: (_, g) => {
        const [full, peek, mini] = getSnaps();
        const cur = lastY.current + g.dy;
        const vy = g.vy; // positive = downward
        let target: number;
        if (vy > 0.4) {
          // Fast flick down
          target = cur < peek / 2 ? peek : mini;
        } else if (vy < -0.4) {
          // Fast flick up
          target = cur > peek ? peek : full;
        } else {
          // Nearest snap point
          const snaps: number[] = [full, peek, mini];
          target = snaps.reduce((best, s) => (Math.abs(s - cur) < Math.abs(best - cur) ? s : best));
        }
        haptics.light();
        lastY.current = target;
        // Dismiss search if sheet dragged down past the full-open position
        if (target > insetsTopRef.current && isSearchingRef.current) {
          isSearchingRef.current = false;
          setSearching(false);
          setSearchQuery('');
        }
        Animated.spring(dragY, {
          toValue: target,
          useNativeDriver: true,
          tension: 300,
          friction: 35,
        }).start();
      },
    }),
  ).current;
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const isSearchingRef = useRef(false);
  const searchInputRef = useRef<any>(null);
  const { forwardGeocode } = useGeocode();
  // ── Micro-interaction animation values ────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeCardScale = useRef(new Animated.Value(1)).current;
  const searchScale = useRef(new Animated.Value(1)).current;
  // ── Service tile stagger entrance ─────────────────────────────────
  const tileAnims = useRef(SERVICES.map(() => new Animated.Value(0))).current;
  const tileScales = useRef(SERVICES.map(() => new Animated.Value(1))).current;
  useEffect(() => {
    tileAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: 120 + i * 80,
        useNativeDriver: true,
        tension: 75,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pulsing live indicator — only runs when there's an active order ──────────────
  useEffect(() => {
    const hasActive = orders?.some((o) => ACTIVE_STATUSES.has(o.status)) ?? false;
    if (!hasActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const pressTile = (idx: number) => {
    Animated.sequence([
      Animated.spring(tileScales[idx], {
        toValue: 0.93,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(tileScales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }),
    ]).start();
  };

  const snapTo = (offset: number) => {
    lastY.current = offset;
    Animated.spring(dragY, {
      toValue: offset,
      useNativeDriver: true,
      tension: 300,
      friction: 35,
    }).start();
  };

  const openSearch = () => {
    haptics.light();
    isSearchingRef.current = true;
    setSearching(true);
    snapTo(insets.top);
    setTimeout(() => searchInputRef.current?.focus(), 200);
  };

  const closeSearch = () => {
    isSearchingRef.current = false;
    setSearching(false);
    setSearchQuery('');
    setAddrSuggestions([]);
    searchInputRef.current?.blur();
    snapTo(getSnaps()[1]);
  };

  const onSearchChange = useCallback(
    async (text: string) => {
      setSearchQuery(text);
      if (text.trim().length < 2) {
        setAddrSuggestions([]);
        return;
      }
      setAddrLoading(true);
      try {
        const results = await forwardGeocode(text);
        setAddrSuggestions(results);
      } finally {
        setAddrLoading(false);
      }
    },
    [forwardGeocode],
  );

  // ── Map dim overlay — darkens as sheet rises ──────────────────────
  const mapDim = dragY.interpolate({
    inputRange: [0, WIN_H],
    outputRange: [0.28, 0],
    extrapolate: 'clamp',
  });

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

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.orders
        .myOrders(token)
        .then(setOrders)
        .catch(() => setOrders([]));
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  const activeOrder = orders?.find((o) => ACTIVE_STATUSES.has(o.status)) ?? null;
  const recentOrders = orders?.filter((o) => !ACTIVE_STATUSES.has(o.status)).slice(0, 3) ?? [];

  return (
    <View style={s.root}>
      {/* ── Full-screen map behind the panel ── */}
      <BaseMap cameraRef={cameraRef} zoom={12} showsUserLocation showsMyLocationButton />

      {/* ── Avatar FAB with unread notification badge ── */}
      <TouchableOpacity
        style={[s.avatarFab, { top: insets.top + 12 }]}
        onPress={() => router.push('/notifications' as any)}
        activeOpacity={0.85}
      >
        <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() ?? '?'}</Text>
        {unreadCount > 0 && (
          <View style={s.notifBadge}>
            <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Map dim overlay ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: mapDim }]}
      />

      {/* ── Bottom sheet panel ── */}
      <Animated.View
        style={[s.panel, { transform: [{ translateY: dragY }] }]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (panelH.current === h) return;
          panelH.current = h;
          // Only set initial position when not searching — avoid resetting on search header height change
          if (isSearchingRef.current) return;
          const peekOffset = Math.round(h * 0.48);
          lastY.current = peekOffset;
          dragY.setValue(peekOffset);
        }}
      >
        {/* Draggable header — changes between normal and search mode */}
        {searching ? (
          // ── Search mode header ──────────────────────────────────
          <View style={[s.searchHeaderWrap, { paddingTop: insets.top + 20 }]} {...pan.panHandlers}>
            <View style={s.searchHeader}>
              <TouchableOpacity style={s.searchBackBtn} onPress={closeSearch} activeOpacity={0.8}>
                <ChevronLeft size={20} color="#111827" />
              </TouchableOpacity>
              <View style={s.searchInputWrap}>
                <Search size={15} color="#9ca3af" />
                <TextInput
                  ref={searchInputRef}
                  style={s.searchInput}
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  placeholder="Kur piegādāt?"
                  placeholderTextColor="#9ca3af"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          // ── Normal header ───────────────────────────────────────
          <View style={s.dragHeader} {...pan.panHandlers}>
            <View style={s.handle} />
            <View style={s.dragHeaderRow}>
              <Animated.View style={{ flex: 1, transform: [{ scale: searchScale }] }}>
                <TouchableOpacity
                  style={s.searchBar}
                  activeOpacity={0.9}
                  onPress={openSearch}
                  onPressIn={() =>
                    Animated.spring(searchScale, {
                      toValue: 0.97,
                      useNativeDriver: true,
                      tension: 300,
                      friction: 8,
                    }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(searchScale, {
                      toValue: 1,
                      useNativeDriver: true,
                      tension: 200,
                      friction: 8,
                    }).start()
                  }
                >
                  <Search size={18} color="#9ca3af" />
                  <Text style={s.searchText}>Kur piegādāt?</Text>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                style={s.notifBtn}
                onPress={() => {
                  haptics.light();
                  router.push('/notifications' as any);
                }}
                activeOpacity={0.8}
              >
                <Bell size={20} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Scrollable content — switches between search UI and normal UI */}
        {searching ? (
          // ── Search content: address suggestions when typing, service shortcuts when not ──
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              s.searchScrollContent,
              { paddingBottom: TAB_H + insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {searchQuery.trim().length >= 2 ? (
              // ── Live address suggestions ─────────────────────────
              addrLoading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#9ca3af" />
              ) : addrSuggestions.length === 0 ? (
                <Text style={s.searchEmpty}>Adrese nav atrasta</Text>
              ) : (
                addrSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.searchSvcRow}
                    onPress={() => {
                      haptics.light();
                      closeSearch();
                      // Navigate to materials order with address pre-context
                      router.push(`/order-request` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={s.searchSvcIcon}>
                      <MapPin size={18} color="#6b7280" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.searchSvcLabel} numberOfLines={1}>
                        {item.place_name.split(',')[0]}
                      </Text>
                      <Text style={s.searchSvcSub} numberOfLines={1}>
                        {item.place_name.split(',').slice(1).join(',').trim()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )
            ) : (
              // ── Default: recent addresses + service shortcuts ────
              <>
                {recentOrders.length > 0 && (
                  <>
                    <Text style={s.searchSectionTitle}>Nesenie pasūtījumi</Text>
                    {recentOrders.map((o) => (
                      <TouchableOpacity
                        key={o.id}
                        style={s.searchSvcRow}
                        onPress={() => {
                          haptics.light();
                          closeSearch();
                          router.push(`/(buyer)/order/${o.id}` as any);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={s.searchSvcIcon}>
                          <MapPin size={18} color="#6b7280" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.searchSvcLabel} numberOfLines={1}>
                            {o.deliveryAddress ?? o.deliveryCity}
                          </Text>
                          <Text style={s.searchSvcSub}>#{o.orderNumber}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                <Text
                  style={[s.searchSectionTitle, { marginTop: recentOrders.length > 0 ? 24 : 0 }]}
                >
                  Pakalpojumi
                </Text>
                {SERVICES.map((svc) => {
                  const Icon = svc.icon;
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      style={s.searchSvcRow}
                      onPress={() => {
                        haptics.light();
                        closeSearch();
                        setTimeout(() => router.push(svc.route as any), 80);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={s.searchSvcIcon}>
                        <Icon size={18} color="#111827" />
                      </View>
                      <Text style={s.searchSvcLabel}>{svc.label}</Text>
                      <ChevronRight size={16} color="#d1d5db" />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.panelScroll, { paddingBottom: TAB_H + insets.bottom }]}
            bounces={false}
            scrollEventThrottle={16}
            onScroll={({ nativeEvent }) => {
              scrollTop.current = nativeEvent.contentOffset.y < 5;
            }}
          >
            {/* Service row — Uber-style horizontal circle buttons */}
            <View style={s.svcRow}>
              {SERVICES.map((svc, idx) => {
                const Icon = svc.icon;
                return (
                  <Animated.View
                    key={svc.id}
                    style={{
                      opacity: tileAnims[idx],
                      transform: [{ scale: tileScales[idx] }],
                      alignItems: 'center',
                      width: '25%',
                    }}
                  >
                    <TouchableOpacity
                      style={s.svcItem}
                      onPress={() => {
                        haptics.light();
                        pressTile(idx);
                        setTimeout(() => router.push(svc.route as any), 70);
                      }}
                      activeOpacity={1}
                    >
                      <View style={s.svcCircle}>
                        <Icon size={24} color="#111827" />
                      </View>
                      <Text style={s.svcLabel}>{svc.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* Active order banner */}
            {activeOrder && (
              <Animated.View style={{ transform: [{ scale: activeCardScale }] }}>
                <TouchableOpacity
                  style={s.activeCard}
                  onPress={() => {
                    haptics.light();
                    router.push(`/(buyer)/order/${activeOrder.id}` as any);
                  }}
                  onPressIn={() =>
                    Animated.spring(activeCardScale, {
                      toValue: 0.97,
                      useNativeDriver: true,
                      tension: 300,
                      friction: 8,
                    }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(activeCardScale, {
                      toValue: 1,
                      useNativeDriver: true,
                      tension: 200,
                      friction: 8,
                    }).start()
                  }
                  activeOpacity={1}
                >
                  {/* Pulsing live dot */}
                  <View style={s.activeDotWrap}>
                    <Animated.View
                      style={[
                        s.activeDotRing,
                        {
                          backgroundColor: STATUS_DOT[activeOrder.status] ?? '#9ca3af',
                          transform: [{ scale: pulseAnim }],
                        },
                      ]}
                    />
                    <View
                      style={[
                        s.activeDot,
                        { backgroundColor: STATUS_DOT[activeOrder.status] ?? '#9ca3af' },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activeLabel}>Aktīvs pasūtījums</Text>
                    <Text style={s.activeNum}>#{activeOrder.orderNumber}</Text>
                    <Text style={s.activeStatus}>
                      {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#6b7280" />
                </TouchableOpacity>
              </Animated.View>
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
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },

  avatarFab: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },

  // Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: WIN_H,
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
  dragHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Search mode ──────────────────────────────────────────────
  searchHeaderWrap: {
    backgroundColor: '#fff',
    paddingBottom: 2,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  searchBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
    fontFamily: 'Inter_400Regular',
  },
  searchScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  searchSvcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  searchSvcIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSvcLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  searchSvcSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  searchEmpty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'Inter_400Regular',
  },

  // Uber-style horizontal service row
  svcRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  svcItem: {
    alignItems: 'center',
    gap: 8,
  },
  svcCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svcLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    textAlign: 'center',
  },

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
  activeDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDotRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.3,
  },
  activeLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', marginBottom: 1 },
  activeNum: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#111827' },
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
  recentTitle: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#111827' },
  recentCta: { fontSize: 12, color: '#111827', fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
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
  recentNum: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: '#111827' },
  recentCity: { fontSize: 11, color: '#9ca3af' },
  recentStatus: { fontSize: 11, color: '#6b7280' },
});
