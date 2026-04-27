import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiTransportJob, ApiVehicle } from '@/lib/api';
import { BaseMap, PinLayer } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import { useIsFocused } from '@react-navigation/native';
import { useHeaderConfig } from '@/lib/header-context';
import * as Location from 'expo-location';
import { Wallet, Trash2, ChevronRight, User, Truck, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/theme';

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
  const isFocused = useIsFocused();
  const { setConfig } = useHeaderConfig();

  const [availableJobs, setAvailableJobs] = useState<ApiTransportJob[]>([]);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [upcomingJobs, setUpcomingJobs] = useState<ApiTransportJob[]>([]);
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);
  const [todayEarnings, setTodayEarnings] = useState<number | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fly camera to driver's current location once on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Small timeout to ensure map is ready
      const timerId = setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
          zoomLevel: 14,
          animationDuration: 1000,
        });
      }, 500);
      return () => clearTimeout(timerId);
    })();
  }, []);

  // Refresh data whenever the screen comes into focus
  const loadData = useCallback(() => {
    if (!token) return Promise.resolve();
    return Promise.allSettled([
      api.transportJobs
        .myActive(token)
        .then((job) => {
          setHasActiveJob(!!job);
          setFetchError(false);
        })
        .catch(() => setFetchError(true)),
      api.driverSchedule
        .getStatus(token)
        .then((s) => setIsOnline(s.isOnline ?? true))
        .catch((err) =>
          console.warn('Driver schedule status failed:', err instanceof Error ? err.message : err),
        ),
      api.transportJobs
        .available(token)
        .then((jobs: ApiTransportJob[]) => {
          setAvailableJobs(Array.isArray(jobs) ? jobs : []);
          setLoadingJobs(false);
          setFetchError(false);
        })
        .catch(() => {
          setLoadingJobs(false);
          setFetchError(true);
        }),
      api.vehicles
        .getAll(token)
        .then((vs: ApiVehicle[]) => setVehicleCount(Array.isArray(vs) ? vs.length : 0))
        .catch(() => setVehicleCount(0)),
      api.transportJobs
        .myJobs(token)
        .then((jobs) => {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          let earnings = 0;
          const upcoming: ApiTransportJob[] = [];
          for (const j of jobs) {
            if (j.status === 'DELIVERED') {
              const d = new Date(j.deliveryDate ?? j.pickupDate);
              if (d >= todayStart) earnings += j.rate;
            }
            // Show ACCEPTED jobs (today or future) as upcoming
            if (j.status === 'ACCEPTED') {
              const d = new Date(j.pickupDate);
              if (d >= todayStart) upcoming.push(j);
            }
          }
          setTodayEarnings(earnings);
          setUpcomingJobs(upcoming.slice(0, 3));
        })
        .catch((err) =>
          console.warn('Driver jobs/earnings failed:', err instanceof Error ? err.message : err),
        ),
    ]);
  }, [token]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const availableCount = Array.isArray(availableJobs) ? availableJobs.length : 0;

  const handleToggleOnline = useCallback(async () => {
    if (!token || togglingOnline || hasActiveJob) return;
    const next = !isOnline;
    setTogglingOnline(true);
    try {
      const res = await api.driverSchedule.toggleOnline(next, token);
      setIsOnline(res.isOnline);
      haptics.medium();
    } catch {
      // revert optimistic update not needed — just ignore
    } finally {
      setTogglingOnline(false);
    }
  }, [token, togglingOnline, hasActiveJob, isOnline]);

  // Reactively update the layout-level TopBar with the driver status pill
  useEffect(() => {
    if (!isFocused) {
      setConfig(null);
      return;
    }
    setConfig({
      centerElement: (
        <TouchableOpacity
          style={[
            s.statusPill,
            hasActiveJob ? s.statusActive : isOnline ? s.statusOnline : s.statusOffline,
          ]}
          onPress={handleToggleOnline}
          activeOpacity={0.8}
          disabled={hasActiveJob || togglingOnline}
        >
          {togglingOnline ? (
            <ActivityIndicator size="small" color={colors.textMuted} style={{ marginRight: 4 }} />
          ) : (
            <View
              style={[
                s.statusDot,
                {
                  backgroundColor: hasActiveJob
                    ? '#10b981'
                    : isOnline
                      ? colors.primary
                      : colors.textDisabled,
                },
              ]}
            />
          )}
          <Text
            style={[s.statusText, !isOnline && !hasActiveJob && { color: colors.textDisabled }]}
          >
            {hasActiveJob ? 'Strādā' : isOnline ? 'Tiešsaistē' : 'Bezsaistē'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [isFocused, hasActiveJob, isOnline, togglingOnline, handleToggleOnline, setConfig]);

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
            top: 60,
            bottom: BOTTOM_PANEL_H + 20,
            left: 0,
            right: 0,
          }}
        >
          {Array.isArray(availableJobs) &&
            availableJobs
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

      {/* 2. Bottom Sheet Card — Slide-up panel styling */}
      <View style={[s.bottomSheet, { height: BOTTOM_PANEL_H }]}>
        {/* Drag handle affordance */}
        <View style={s.dragHandle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00A878" />
          }
        >
          {/* Greeting / User Context */}
          <View style={s.sheetHeader}>
            <Text style={s.greetingLabel}>{greeting()},</Text>
            <Text style={s.greetingName}>{user?.firstName}</Text>
          </View>

          {/* Detailed Stats Row */}
          <View style={s.statsContainer}>
            <View style={s.statBox}>
              <Text style={s.statValue}>{loadingJobs ? '--' : availableCount}</Text>
              <Text style={s.statLabel}>Pieejami darbi</Text>
            </View>
            <View style={s.verticalLine} />
            <View style={s.statBox}>
              <Text style={s.statValue}>
                {todayEarnings !== null ? `€${todayEarnings.toFixed(0)}` : '--'}
              </Text>
              <Text style={s.statLabel}>Nopelnīts šodien</Text>
            </View>
          </View>

          {/* Upcoming accepted jobs — shown when driver has scheduled work today */}
          {upcomingJobs.length > 0 && !hasActiveJob && (
            <View style={s.upcomingSection}>
              <View style={s.upcomingSectionHeader}>
                <Text style={s.upcomingSectionTitle}>Nākamie darbi</Text>
                <TouchableOpacity onPress={() => router.push('/(driver)/jobs')} hitSlop={8}>
                  <Text style={s.upcomingSeeAll}>Visi →</Text>
                </TouchableOpacity>
              </View>
              {upcomingJobs.map((job) => {
                const pickupDate = new Date(job.pickupDate);
                const isToday = pickupDate.toDateString() === new Date().toDateString();
                const timeLabel = pickupDate.toLocaleTimeString('lv-LV', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={s.upcomingCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      haptics.light();
                      router.push('/(driver)/active');
                    }}
                  >
                    <View style={s.upcomingCardLeft}>
                      <Text style={s.upcomingTime}>
                        {isToday
                          ? 'Šodien'
                          : pickupDate.toLocaleDateString('lv-LV', { weekday: 'short' })}{' '}
                        {timeLabel}
                      </Text>
                      <Text style={s.upcomingRoute} numberOfLines={1}>
                        {job.pickupCity} → {job.deliveryCity}
                      </Text>
                    </View>
                    <View style={s.upcomingCardRight}>
                      <Text style={s.upcomingEarning}>€{job.rate?.toFixed(0) ?? '—'}</Text>
                      <ArrowRight size={14} color={colors.textDisabled} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* First-run prompt: no vehicles registered yet */}
          {vehicleCount === 0 && !hasActiveJob && (
            <TouchableOpacity
              style={s.vehiclePrompt}
              activeOpacity={0.8}
              onPress={() => {
                haptics.medium();
                router.push('/(driver)/vehicles');
              }}
            >
              <View style={s.vehiclePromptIcon}>
                <Truck size={20} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.vehiclePromptTitle}>Pievienojiet transportlīdzekli</Text>
                <Text style={s.vehiclePromptSub}>Jums nav reģistrētu auto</Text>
              </View>
              <ArrowRight size={16} color="#4b5563" />
            </TouchableOpacity>
          )}

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
            {!hasActiveJob && (
              <ChevronRight size={24} color={colors.white} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>

          {/* Empty hint — only when not loading and no jobs nearby */}
          {fetchError && (
            <Text style={[s.noJobsHint, { color: colors.danger }]}>
              Neizdevās ielādēt datus — pārbaudiet savienojumu
            </Text>
          )}
          {!fetchError && !hasActiveJob && !loadingJobs && availableCount === 0 && (
            <Text style={s.noJobsHint}>Nav pieejamo darbu jūsu reģionā</Text>
          )}

          {/* Secondary Quick Actions — Clean icons */}
          <View style={s.quickGrid}>
            <QuickAction
              icon={<Wallet size={20} color="#4b5563" />}
              label="Ienākumi"
              onPress={() => router.push('/(driver)/earnings')}
            />
            <QuickAction
              icon={<Truck size={20} color="#4b5563" />}
              label="Transportlīdzekļi"
              onPress={() => router.push('/(driver)/vehicles')}
            />
            {user?.canSkipHire && (
              <QuickAction
                icon={<Trash2 size={20} color="#4b5563" />}
                label="Konteineri"
                onPress={() => router.push('/(driver)/skips')}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={s.quickItem}
      activeOpacity={0.7}
      onPress={() => {
        haptics.light();
        onPress();
      }}
    >
      <View style={s.quickIcon}>{icon}</View>
      <Text style={s.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
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
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statusOnline: {},
  statusOffline: { backgroundColor: colors.bgMuted, borderColor: '#d1d5db' },
  statusActive: {},
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  greetingLabel: { fontSize: 20, color: colors.textMuted, fontWeight: '500' },
  greetingName: { fontSize: 20, color: colors.textPrimary, fontWeight: '700', marginLeft: 6 },

  // Stats Grid
  statsContainer: { flexDirection: 'row', marginBottom: 24 },
  statBox: { flex: 1 },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  verticalLine: { width: 1, backgroundColor: colors.bgMuted, marginHorizontal: 20 },

  // Primary Action
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 62,
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 24,
  },
  primaryActionActive: { backgroundColor: colors.success },
  primaryActionText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  noJobsHint: { fontSize: 13, color: colors.textDisabled, textAlign: 'center', marginTop: 10 },

  // Vehicle first-run prompt
  vehiclePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgSubtle,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehiclePromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePromptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  vehiclePromptSub: { fontSize: 12, color: colors.textMuted },

  // Quick Actions
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  quickItem: { alignItems: 'center', gap: 8 },
  quickIcon: {},
  quickLabel: { fontSize: 12, color: '#4b5563', fontWeight: '500' },

  // Upcoming Jobs
  upcomingSection: { marginBottom: 20 },
  upcomingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upcomingSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upcomingSeeAll: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSubtle,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upcomingCardLeft: { flex: 1, marginRight: 8 },
  upcomingTime: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
  upcomingRoute: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  upcomingCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upcomingEarning: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
