import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiTransportJob } from '@/lib/api';
import { BaseMap, PinLayer } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import * as Location from 'expo-location';
import {
  ClipboardList,
  Map,
  Wallet,
  Trash2,
  CheckCircle2,
  Circle,
  Bell,
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
    sub: 'Konteineru piegādes',
    route: '/(driver)/skips',
  },
];

const TAB_H = 52;

export default function DriverHomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRefHandle | null>(null);

  const [availableJobs, setAvailableJobs] = useState<ApiTransportJob[]>([]);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fly camera to driver's current location once on mount
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

  // Refresh data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.transportJobs
        .myActive(token)
        .then((job) => setHasActiveJob(!!job))
        .catch(() => {});
      api.transportJobs
        .available(token)
        .then((jobs: ApiTransportJob[]) => setAvailableJobs(jobs))
        .catch(() => {});
      api.notifications
        .unreadCount(token)
        .then((res: { count: number }) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  const availableCount = availableJobs.length;

  return (
    <View style={s.root}>
      {/* ── Map — top 42% ── */}
      <View style={s.mapWrap}>
        <BaseMap cameraRef={cameraRef} zoom={12} showsUserLocation showsMyLocationButton>
          {availableJobs
            .filter((j) => j.pickupLat != null && j.pickupLng != null)
            .map((j) => (
              <PinLayer
                key={j.id}
                id={j.id}
                coordinate={{ lat: j.pickupLat!, lng: j.pickupLng! }}
                type="pickup"
                label={j.pickupCity}
              />
            ))}
        </BaseMap>

        {/* Avatar FAB — top-left */}
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

        {/* Bell FAB — top-right */}
        <TouchableOpacity
          style={[s.bellFab, { top: insets.top + 12 }]}
          activeOpacity={0.8}
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
        >
          <Bell size={18} color="#111827" />
          {unreadCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Content — below the map ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: TAB_H + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={s.greetingRow}>
          <Text style={s.greetingLabel}>{greeting()},</Text>
          <Text style={s.greetingName}>{user?.firstName ?? ''}</Text>
        </View>

        {/* Status chips */}
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
                hasActiveJob ? s.statusChipTextActive : s.statusChipTextIdle,
              ]}
            >
              {hasActiveJob ? 'Aktīvs darbs' : 'Nav aktīva darba'}
            </Text>
          </View>
          {availableCount > 0 && (
            <View style={s.statusChip}>
              <Text style={s.statusChipNum}>{availableCount}</Text>
              <Text style={s.statusChipText}> pieejami darbi</Text>
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

        {/* Quick-action tiles 2×2 */}
        <View style={s.grid}>
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.gridTile, { width: '48%' }]}
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  // Map wrapper — top 42% of screen
  mapWrap: { height: '42%' as any },

  // FABs overlaid on map
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
  avatarFabText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  bellFab: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Content scroll area
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  // Greeting
  greetingRow: {},
  greetingLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  greetingName: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: -4 },

  // Status chips
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
  statusChipActive: { borderColor: '#111827', backgroundColor: '#f9fafb' },
  statusChipIdle: {},
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  statusChipTextActive: { color: '#111827' },
  statusChipTextIdle: { color: '#9ca3af' },
  statusChipNum: { fontSize: 13, fontWeight: '800', color: '#111827' },

  // Primary CTA button
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // 2×2 quick-action grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridTile: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 5,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
