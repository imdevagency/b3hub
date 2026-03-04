/**
 * NavigationScreen — full-screen in-app turn-by-turn navigation
 * powered by the Google Maps Navigation SDK.
 *
 * ⚠️  REQUIRES A CUSTOM DEV BUILD (not compatible with Expo Go).
 *     Run:  npx expo prebuild  then  npx expo run:ios / run:android
 *
 * Route params (passed via expo-router):
 *   - pickupLat / pickupLng   (optional, if driver hasn't reached pickup yet)
 *   - deliveryLat / deliveryLng
 *   - label                   destination label shown in the UI
 *   - jobId                   used to call back status transitions
 *
 * Flow:
 *   1. Show Google ToS dialog (required by SDK)
 *   2. init() the navigation session
 *   3. If pickup coords provided → setDestination to pickup first
 *      else → setDestination straight to delivery
 *   4. startGuidance()
 *   5. On arrival at pickup → setDestination to delivery, resume guidance
 *   6. On arrival at delivery → pop back to active.tsx
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, MapPin, Truck } from 'lucide-react-native';
import { t } from '@/lib/translations';

// ── Lazy-load the native SDK — crashes in Expo Go if imported statically ──────
let _NavigationView: React.ComponentType<any> | null = null;
let _useNavigationController: ((...args: any[]) => any) | null = null;
let _TaskRemovedBehaviorContinue = 0;
try {
  const sdk = require('@googlemaps/react-native-navigation-sdk');
  _NavigationView = sdk.NavigationView;
  _useNavigationController = sdk.useNavigationController;
  _TaskRemovedBehaviorContinue = sdk.TaskRemovedBehavior?.CONTINUE_SERVICE ?? 0;
} catch (_) {
  // Native module unavailable — Expo Go / no custom dev build
}
type NavigationViewController = any;

// ── Fallback shown when SDK is unavailable ────────────────────────────────────
function NavigationUnavailable() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.fallbackSafe} edges={['top', 'bottom']}>
      <View style={styles.fallbackCenter}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackTitle}>Navigācija nav pieejama</Text>
        <Text style={styles.fallbackDesc}>
          GPS navigācija darbojas tikai ar pielāgotu dev build.{`\n`}
          Palaidiet: <Text style={styles.fallbackCode}>npx expo run:ios</Text> vai{' '}
          <Text style={styles.fallbackCode}>npx expo run:android</Text>
        </Text>
        <TouchableOpacity style={styles.fallbackBtn} onPress={() => router.back()}>
          <Text style={styles.fallbackBtnText}>Atpakaļ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Nav stage ─────────────────────────────────────────────────────────────────
type NavStage = 'initialising' | 'to_pickup' | 'to_delivery' | 'arrived';

export default function NavigationScreen() {
  if (!_NavigationView || !_useNavigationController) {
    return <NavigationUnavailable />;
  }
  return <NavigationScreenNative />;
}

function NavigationScreenNative() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickupLat?: string;
    pickupLng?: string;
    deliveryLat?: string;
    deliveryLng?: string;
    label?: string;
  }>();

  const deliveryLat = parseFloat(params.deliveryLat ?? '0');
  const deliveryLng = parseFloat(params.deliveryLng ?? '0');
  const pickupLat = params.pickupLat ? parseFloat(params.pickupLat) : null;
  const pickupLng = params.pickupLng ? parseFloat(params.pickupLng) : null;
  const hasPickup = pickupLat !== null && pickupLng !== null;

  const [stage, setStage] = useState<NavStage>('initialising');
  const [eta, setEta] = useState<string>('');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const navViewControllerRef = useRef<NavigationViewController | null>(null);

  // ── Navigation controller (routing logic) ────────────────────────────────
  const {
    navigationController,
    setOnNavigationReady,
    setOnArrival,
    setOnRemainingTimeOrDistanceChanged,
    removeAllListeners,
  } = _useNavigationController!(
    {
      title: t.navigation.tosTitle,
      companyName: 'B3Hub',
    },
    _TaskRemovedBehaviorContinue,
  );

  // ── Arrival handler ───────────────────────────────────────────────────────
  const handleArrival = useCallback(async () => {
    if (stage === 'to_pickup' && hasPickup) {
      // Arrived at pickup → now navigate to delivery
      setStage('to_delivery');
      try {
        await navigationController.setDestination(
          {
            position: { lat: deliveryLat, lng: deliveryLng },
            title: params.label ?? t.navigation.deliveryLabel,
          },
          { routingOptions: { travelMode: 1 /* DRIVING */ } },
        );
        await navigationController.startGuidance();
      } catch (err) {
        console.warn('Nav setDestination delivery error', err);
      }
    } else {
      // Arrived at final destination
      setStage('arrived');
      await navigationController.stopGuidance();
      Alert.alert(
        t.navigation.arrivedTitle,
        params.label ? t.navigation.arrivedAtLabel(params.label) : t.navigation.arrivedDesc,
        [{ text: t.common.ok, onPress: () => router.back() }],
      );
    }
  }, [stage, hasPickup, deliveryLat, deliveryLng, navigationController, params.label, router]);

  // ── Init navigation session ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function startNav() {
      try {
        const accepted = await navigationController.showTermsAndConditionsDialog();
        if (!accepted) {
          Alert.alert(t.navigation.tosRequired, '', [
            { text: t.common.ok, onPress: () => router.back() },
          ]);
          return;
        }

        await navigationController.init();

        if (!mounted) return;

        const firstStop = hasPickup
          ? { position: { lat: pickupLat!, lng: pickupLng! }, title: t.navigation.pickupLabel }
          : {
              position: { lat: deliveryLat, lng: deliveryLng },
              title: params.label ?? t.navigation.deliveryLabel,
            };

        await navigationController.setDestination(firstStop, {
          routingOptions: { travelMode: 1 /* DRIVING */ },
        });

        setStage(hasPickup ? 'to_pickup' : 'to_delivery');
        await navigationController.startGuidance();
      } catch (err) {
        console.error('Navigation init error:', err);
        Alert.alert(t.navigation.errorTitle, String(err), [
          { text: t.common.ok, onPress: () => router.back() },
        ]);
      }
    }

    // Wire listeners before starting
    setOnNavigationReady(() => startNav());
    setOnArrival(() => handleArrival());
    setOnRemainingTimeOrDistanceChanged((data) => {
      if (!mounted) return;
      const mins = Math.round((data.seconds ?? 0) / 60);
      setEta(mins > 0 ? `${mins} min` : '');
      setDistanceM(data.meters ?? null);
    });

    return () => {
      mounted = false;
      removeAllListeners();
      navigationController.cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop navigation ───────────────────────────────────────────────────────
  async function stopNavigation() {
    try {
      await navigationController.stopGuidance();
    } catch (_) {}
    router.back();
  }

  // ── Stage label ───────────────────────────────────────────────────────────
  const stageLabel =
    stage === 'initialising'
      ? t.navigation.initialising
      : stage === 'to_pickup'
        ? t.navigation.headingToPickup
        : stage === 'to_delivery'
          ? t.navigation.headingToDelivery
          : t.navigation.arrived;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Full-screen Google Navigation View */}
      <_NavigationView
        style={StyleSheet.absoluteFillObject}
        onNavigationViewControllerCreated={(vc: NavigationViewController) => {
          navViewControllerRef.current = vc;
        }}
      />

      {/* Top HUD — stage + ETA + close button */}
      <SafeAreaView style={styles.hudWrapper} edges={['top']}>
        <View style={styles.hud}>
          <View style={styles.hudLeft}>
            {stage === 'initialising' ? (
              <ActivityIndicator color="#16a34a" size="small" />
            ) : stage === 'to_pickup' ? (
              <Truck size={18} color="#16a34a" />
            ) : (
              <MapPin size={18} color="#dc2626" />
            )}
            <Text style={styles.hudStage}>{stageLabel}</Text>
          </View>

          <View style={styles.hudCenter}>
            {distanceM !== null && (
              <Text style={styles.hudDist}>
                {distanceM >= 1000
                  ? `${(distanceM / 1000).toFixed(1)} km`
                  : `${Math.round(distanceM)} m`}
              </Text>
            )}
            {eta ? <Text style={styles.hudEta}>{eta}</Text> : null}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={stopNavigation}>
            <X size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  hudWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  hud: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  hudStage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  hudCenter: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  hudDist: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  hudEta: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Fallback
  fallbackSafe: { flex: 1, backgroundColor: '#f2f2f7' },
  fallbackCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  fallbackEmoji: { fontSize: 56 },
  fallbackTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  fallbackDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  fallbackCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#dc2626',
    fontSize: 13,
  },
  fallbackBtn: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  fallbackBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
