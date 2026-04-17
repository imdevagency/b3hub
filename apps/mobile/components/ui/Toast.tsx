import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, Info } from 'lucide-react-native';
import { colors } from '@/lib/theme';

// ── Types ────────────────────────────────────────────────────────────────────
type ToastVariant = 'success' | 'error' | 'info';

interface ToastConfig {
  message: string;
  variant?: ToastVariant;
  duration?: number; // ms, default 3000
}

interface ToastContextValue {
  showToast: (msg: string, variant?: ToastVariant) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────
// Suppress repeat error toasts with the same message for 2 minutes.
// This prevents polling failures from spamming the user during server outages
// while still surfacing the first occurrence and any new/different errors.
const ERROR_REPEAT_SUPPRESS_MS = 120_000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const slideY = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Maps error message → timestamp when it was last shown
  const shownErrorsRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: -90,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setConfig(null));
  }, [slideY, opacity, scale]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 3000) => {
      // Suppress repeat error toasts — same message shown within the last 2 minutes
      // is silently dropped. This prevents polling failures from spamming during outages.
      if (variant === 'error') {
        const now = Date.now();
        const lastShownAt = shownErrorsRef.current.get(message) ?? 0;
        if (now - lastShownAt < ERROR_REPEAT_SUPPRESS_MS) return;
        shownErrorsRef.current.set(message, now);
        // Evict stale entries so the map doesn't grow unbounded
        for (const [msg, ts] of shownErrorsRef.current) {
          if (now - ts > ERROR_REPEAT_SUPPRESS_MS) shownErrorsRef.current.delete(msg);
        }
      }

      if (timerRef.current) clearTimeout(timerRef.current);

      // Reset before re-animating (handles rapid re-triggers)
      scale.setValue(0.9);
      slideY.setValue(-90);
      setConfig({ message, variant, duration });

      // Slide + scale pop-in
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          tension: 100,
          friction: 14,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 14,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(dismiss, duration);
    },
    [slideY, scale, opacity, dismiss],
  );

  const value: ToastContextValue = {
    showToast,
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    info: (msg) => showToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {config && (
        <ToastBanner config={config} translateY={slideY} opacity={opacity} scale={scale} />
      )}
    </ToastContext.Provider>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────
const VARIANT_STYLE: Record<
  ToastVariant,
  { bg: string; border: string; iconColor: string; accentColor: string }
> = {
  success: { bg: '#ffffff', border: '#d1fae5', iconColor: '#059669', accentColor: '#059669' },
  error: { bg: '#ffffff', border: '#fee2e2', iconColor: '#dc2626', accentColor: '#dc2626' },
  info: { bg: '#ffffff', border: '#dbeafe', iconColor: '#2563eb', accentColor: '#2563eb' },
};

const ICONS: Record<ToastVariant, React.ComponentType<{ size: number; color: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

function ToastBanner({
  config,
  translateY,
  opacity,
  scale,
}: {
  config: ToastConfig;
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}) {
  const insets = useSafeAreaInsets();
  const variant = config.variant ?? 'info';
  const style = VARIANT_STYLE[variant];
  const Icon = ICONS[variant];

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: insets.top + (Platform.OS === 'android' ? 8 : 4),
          backgroundColor: style.bg,
          borderColor: style.border,
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <Icon size={18} color={style.iconColor} />
      <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={2}>
        {config.message}
      </Text>
      <View style={[styles.accent, { backgroundColor: style.accentColor }]} />
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  accent: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginLeft: 4,
  },
});
