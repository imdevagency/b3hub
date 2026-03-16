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
import {
  ClipboardList,
  Map,
  Wallet,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Circle,
  Search,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const QUICK_ACTIONS = [
  {
    id: 'jobs',
    icon: ClipboardList,
    label: 'Darbu saraksts',
    sub: 'Pieejamie kravu darbi',
    route: '/(driver)/jobs',
  },
  {
    id: 'active',
    icon: Map,
    label: 'Aktīvs darbs',
    sub: 'Maršruts un statuss',
    route: '/(driver)/active',
  },
  {
    id: 'earnings',
    icon: Wallet,
    label: 'Mani ienākumi',
    sub: 'Statistika un nopelnītais',
    route: '/(driver)/earnings',
  },
  {
    id: 'skips',
    icon: Trash2,
    label: 'Konteineri',
    sub: 'Konteinu piegādes',
    route: '/(driver)/skips',
  },
];

const TAB_H = 52;
const WIN_H = Dimensions.get('window').height;
const PEEK_H = 76;

export default function DriverHomeScreen() {
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
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [hasActiveJob, setHasActiveJob] = useState(false);

  // Tile stagger
  const tileAnims = useRef(
    QUICK_ACTIONS.map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(20) })),
  ).current;
  useEffect(() => {
    QUICK_ACTIONS.forEach((_, i) => {
      const delay = Animated.delay(i * 70);
      Animated.sequence([
        delay,
        Animated.parallel([
          Animated.spring(tileAnims[i].opacity, {
            toValue: 1,
            useNativeDriver: true,
            tension: 72,
            friction: 11,
          }),
          Animated.spring(tileAnims[i].y, {
            toValue: 0,
            useNativeDriver: true,
            tension: 72,
            friction: 11,
          }),
        ]),
      ]).start();
    });
  }, []);

  // Fly camera to driver's current location
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

  // Fetch active job + available count
  useEffect(() => {
    if (!token) return;
    api.transportJobs
      .myActive(token)
      .then((job) => setHasActiveJob(!!job))
      .catch(() => {});
    api.transportJobs
      .available(token)
      .then((jobs: import('@/lib/api').ApiTransportJob[]) => setAvailableCount(jobs.length))
      .catch(() => {});
  }, [token]);

  return (
    <View style={s.root}>
      {/* Full-screen map */}
      <BaseMap cameraRef={cameraRef} zoom={12} showsUserLocation showsMyLocationButton />

      {/* Avatar FAB */}
      {user && (
        <TouchableOpacity
          style={[s.avatarFab, { top: insets.top + 12 }]}
          activeOpacity={0.8}
          onPress={() => {
            haptics.light();
            router.push('/(driver)/profile' as any);
          }}
        >
          <Text style={s.avatarFabText}>
            {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}
          </Text>
        </TouchableOpacity>
      )}

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
          <TouchableOpacity
            style={s.searchBar}
            activeOpacity={0.7}
            onPress={() => haptics.medium()}
          >
            <Search size={18} color="#9ca3af" />
            <Text style={s.searchText}>Meklēt darbus...</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.panelScroll, { paddingBottom: TAB_H + insets.bottom }]}
          bounces={false}
        >
          {/* Greeting */}
          <View>
            <Text style={s.greetingText}>
              {greeting()}, {user?.firstName ?? ''}!
            </Text>
            <Text style={s.headline}>Kā iet?</Text>
          </View>

          {/* Status row */}
          <View style={s.statusRow}>
            <View style={[s.statusChip, hasActiveJob ? s.statusChipActive : s.statusChipIdle]}>
              {hasActiveJob ? (
                <CheckCircle2 size={14} color="#059669" />
              ) : (
                <Circle size={14} color="#9ca3af" />
              )}
              <Text
                style={[
                  s.statusChipText,
                  hasActiveJob ? { color: '#059669' } : { color: '#9ca3af' },
                ]}
              >
                {hasActiveJob ? 'Aktīvs darbs' : 'Nav aktīva darba'}
              </Text>
            </View>
            {availableCount != null && (
              <View style={s.statusChip}>
                <Text style={s.statusChipNum}>{availableCount}</Text>
                <Text style={s.statusChipText}>pieejami darbi</Text>
              </View>
            )}
          </View>

          {/* Primary CTA */}
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => {
              haptics.medium();
              router.push('/(driver)/jobs' as any);
            }}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Meklēt darbus →</Text>
          </TouchableOpacity>

          {/* Quick action tiles 2×2 */}
          <View style={s.grid}>
            {QUICK_ACTIONS.map((a, idx) => {
              const Icon = a.icon;
              return (
                <Animated.View
                  key={a.id}
                  style={{
                    opacity: tileAnims[idx].opacity,
                    transform: [{ translateY: tileAnims[idx].y }],
                    width: '48%',
                  }}
                >
                  <TouchableOpacity
                    style={[s.gridTile, { width: '100%' }]}
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
                </Animated.View>
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

  greetingText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  headline: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: -6 },

  // Status chips
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statusChipActive: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  statusChipIdle: { borderColor: '#f3f4f6' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  statusChipNum: { fontSize: 13, fontWeight: '800', color: '#111827' },

  // Primary button
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
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

  // Avatar FAB
  avatarFab: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  avatarFabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
