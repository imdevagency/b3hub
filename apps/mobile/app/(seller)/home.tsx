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
import { BaseMap } from '@/components/map';
import * as Location from 'expo-location';
import { Inbox, LayoutGrid, FileText, Wallet, Search } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const QUICK_ACTIONS = [
  {
    id: 'incoming',
    icon: Inbox,
    label: 'Ienākošie',
    sub: 'Jauni pasūtījumi',
    route: '/(seller)/incoming',
  },
  {
    id: 'catalog',
    icon: LayoutGrid,
    label: 'Katalogs',
    sub: 'Pārvaldīt materiālus',
    route: '/(seller)/catalog',
  },
  {
    id: 'quotes',
    icon: FileText,
    label: 'Pieprasījumi',
    sub: 'Cenu pieprasījumi',
    route: '/(seller)/quotes',
  },
  {
    id: 'earnings',
    icon: Wallet,
    label: 'Ienākumi',
    sub: 'Pārdošanas statistika',
    route: '/(seller)/earnings',
  },
];

const TAB_H = 52;
const WIN_H = Dimensions.get('window').height;
const PEEK_H = 76;

export default function SellerHomeScreen() {
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
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Fly camera to seller's location
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

  // Count pending/confirmed orders visible to seller
  useEffect(() => {
    if (!token) return;
    api.orders
      .myOrders(token)
      .then((orders) => {
        const pending = orders.filter(
          (o) => o.status === 'PENDING' || o.status === 'CONFIRMED',
        ).length;
        setPendingCount(pending);
      })
      .catch(() => {});
  }, [token]);

  return (
    <View style={s.root}>
      {/* Full-screen map */}
      <BaseMap cameraRef={cameraRef} zoom={12} showsUserLocation showsMyLocationButton />

      {/* Bottom panel */}
      <Animated.View
        style={[s.panel, { transform: [{ translateY: dragY }] }]}
        onLayout={(e) => {
          panelH.current = e.nativeEvent.layout.height;
        }}
      >
        {/* Draggable header */}
        <View style={s.dragHeader} {...pan.panHandlers}>
          <View style={s.handle} />
          <TouchableOpacity style={s.searchBar} activeOpacity={0.7} onPress={() => haptics.light()}>
            <Search size={18} color="#9ca3af" />
            <Text style={s.searchText}>Ienākošie pasūtījumi...</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.panelScroll, { paddingBottom: TAB_H + insets.bottom }]}
          bounces={false}
        >
          {/* Pending orders badge */}
          {pendingCount != null && pendingCount > 0 && (
            <TouchableOpacity
              style={s.alertCard}
              onPress={() => {
                haptics.light();
                router.push('/(seller)/incoming' as any);
              }}
              activeOpacity={0.8}
            >
              <View style={s.alertBadge}>
                <Text style={s.alertBadgeNum}>{pendingCount}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alertTitle}>Jauni pasūtījumi gaida</Text>
                <Text style={s.alertSub}>Apstipriniet vai noraidiet</Text>
              </View>
              <Text style={s.alertCta}>Skatīt →</Text>
            </TouchableOpacity>
          )}

          {/* Primary CTA */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              haptics.medium();
              router.push('/(seller)/incoming' as any);
            }}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Ienākošie pasūtījumi →</Text>
          </TouchableOpacity>

          {/* Quick action tiles 2×2 */}
          <View style={s.grid}>
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={s.gridTile}
                  onPress={() => {
                    haptics.light();
                    router.push(a.route as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={s.gridIcon}>
                    <Icon size={20} color="#111827" />
                  </View>
                  <Text style={s.gridLabel}>{a.label}</Text>
                  <Text style={s.gridSub} numberOfLines={1}>
                    {a.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

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

  greetingText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  headline: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: -6 },

  // Alert card for pending orders
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fefce8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
  },
  alertBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeNum: { color: '#fff', fontWeight: '800', fontSize: 15 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  alertSub: { fontSize: 12, color: '#a16207', marginTop: 1 },
  alertCta: { fontSize: 13, fontWeight: '700', color: '#92400e' },

  // Primary button
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // 2×2 grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridTile: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 16,
    gap: 5,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  gridLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  gridSub: { fontSize: 11, color: '#9ca3af', lineHeight: 15 },
});
