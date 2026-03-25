import os

file_path = "apps/mobile/app/(driver)/home.tsx"

new_content = """import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
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
  Bell,
  Wallet,
  Calendar,
  Trash2,
  ChevronRight,
  User,
  ListFilter,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

// Utility for greeting
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_H = SCREEN_HEIGHT * 0.45;

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
      // Small timeout to ensure map is ready
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
          zoomLevel: 14,
          animationDuration: 1000,
        });
      }, 500);
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
        .then((jobs: ApiTransportJob[]) => setAvailableJobs(Array.isArray(jobs) ? jobs : []))
        .catch(() => {});
      api.notifications
        .unreadCount(token)
        .then((res: { count: number }) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  const availableCount = Array.isArray(availableJobs) ? availableJobs.length : 0;
  
  // Ensure safe bottom padding for iPhone X/11/etc home indicator
  const bottomInset = insets.bottom > 0 ? insets.bottom : 20;

  return (
    <ScreenContainer topInset={0} bg="transparent">
      {/* 1. Full Screen Map As Background */}
      <View style={StyleSheet.absoluteFill}>
        {/* mapPadding pushes the Google logo/legal links up so they aren't hidden by our bottom sheet */}
        <BaseMap 
          cameraRef={cameraRef} 
          zoom={12} 
          showsUserLocation 
          showsMyLocationButton={false}
          style={StyleSheet.absoluteFill}
          mapPadding={{ 
            top: insets.top + 60, 
            bottom: BOTTOM_PANEL_H + 20, 
            left: 0, 
            right: 0 
          }}
        >
          {Array.isArray(availableJobs) && availableJobs
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
      </View>

      {/* 2. Floating Header (Top Bar) — Transparent, laid over map */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          {/* Avatar Button */}
          <TouchableOpacity
            style={s.roundBtn}
            activeOpacity={0.9}
            onPress={() => {
              haptics.light();
              router.push('/(driver)/profile');
            }}
          >
            <View style={s.avatarFill}>
               <Text style={s.avatarText}>
                 {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
               </Text>
            </View>
          </TouchableOpacity>
          
          {/* Status Pill in Center */}
          <View style={[s.statusPill, hasActiveJob ? s.statusActive : s.statusOnline]}>
             <View style={[s.statusDot, { backgroundColor: hasActiveJob ? '#10b981' : '#111827' }]} />
             <Text style={s.statusText}>{hasActiveJob ? 'Strādā' : 'Tiešsaistē'}</Text>
          </View>

          {/* Notification Bell */}
          <TouchableOpacity
            style={s.roundBtn}
            activeOpacity={0.9}
            onPress={() => {
              haptics.light();
              router.push('/notifications');
            }}
          >
            <Bell size={20} color="#111827" />
            {unreadCount > 0 && <View style={s.badge} />}
          </TouchableOpacity>
      </View>

      {/* 3. Bottom Sheet Card — Slide-up panel styling */}
      <View style={[s.bottomSheet, { height: BOTTOM_PANEL_H, paddingBottom: bottomInset + 10 }]}>
          {/* Greeting / User Context */}
          <View style={s.sheetHeader}>
             <Text style={s.greetingLabel}>{greeting()},</Text>
             <Text style={s.greetingName}>{user?.firstName}</Text>
          </View>
          
          {/* Detailed Stats Row */}
          <View style={s.statsContainer}>
             <View style={s.statBox}>
                <Text style={s.statValue}>{availableCount}</Text>
                <Text style={s.statLabel}>Pieejami darbi</Text>
             </View>
             <View style={s.verticalLine} />
             <View style={s.statBox}>
                <Text style={s.statValue}>--</Text> 
                <Text style={s.statLabel}>Nopelnīts šodien</Text>
             </View>
          </View>

          {/* Primary Action Button — The Big Button */}
          <TouchableOpacity
            style={[s.primaryAction, hasActiveJob && s.primaryActionActive]}
            activeOpacity={0.8}
            onPress={() => {
              haptics.medium();
              if (hasActiveJob) {
                 router.push('/(driver)/active');
              } else {
                 router.push('/(driver)/jobs');
              }
            }}
          >
            <Text style={s.primaryActionText}>
              {hasActiveJob ? 'ATVĒRT DARBU' : 'MEKLĒT DARBUS'}
            </Text>
            {!hasActiveJob && <ChevronRight size={24} color="#fff" style={{ marginLeft: 4 }} />}
          </TouchableOpacity>

          {/* Secondary Quick Actions — Clean icons */}
          <View style={s.quickGrid}>
              <QuickAction 
                 icon={<Wallet size={20} color="#4b5563" />} 
                 label="Ienākumi" 
                 onPress={() => router.push('/(driver)/earnings')} 
              />
              <QuickAction 
                 icon={<Calendar size={20} color="#4b5563" />} 
                 label="Grafiks" 
                 onPress={() => router.push('/(driver)/schedule')}
              />
              <QuickAction 
                 icon={<Trash2 size={20} color="#4b5563" />} 
                 label="Konteineri" 
                 onPress={() => router.push('/(driver)/skips')} 
              />
          </View>
      </View>
    </ScreenContainer>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any, label: string, onPress: () => void }) {
   return (
      <TouchableOpacity style={s.quickItem} activeOpacity={0.7} onPress={() => { haptics.light(); onPress(); }}>
         <View style={s.quickIcon}>{icon}</View>
         <Text style={s.quickLabel}>{label}</Text>
      </TouchableOpacity>
   )
}

const s = StyleSheet.create({
  // Header
  header: {
    position: 'absolute',
    left: 0, 
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarFill: {
    width: '100%', height: '100%', borderRadius: 23, backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  badge: {
     position: 'absolute', top: 10, right: 10, width: 10, height: 10,
     borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' 
  },
  
  // Status Pill
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  statusOnline: {},
  statusActive: {},
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#111827', textTransform: 'uppercase' },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 25, shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  greetingLabel: { fontSize: 20, color: '#6b7280', fontWeight: '500' },
  greetingName: { fontSize: 20, color: '#111827', fontWeight: '800', marginLeft: 6 },

  // Stats Grid
  statsContainer: { flexDirection: 'row', marginBottom: 28 },
  statBox: { flex: 1 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  verticalLine: { width: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20 },

  // Primary Action
  primaryAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827', borderRadius: 20, height: 62,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
    marginBottom: 32,
  },
  primaryActionActive: { backgroundColor: '#059669' },
  primaryActionText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

  // Quick Actions
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  quickItem: { alignItems: 'center', gap: 8 },
  quickIcon: {}, 
  quickLabel: { fontSize: 12, color: '#4b5563', fontWeight: '500' }
});"""

with open(file_path, "w") as f:
    f.write(new_content)
