import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, Info } from 'lucide-react-native';

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
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const slideY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setConfig(null));
  }, [slideY, opacity]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setConfig({ message, variant, duration });

      // Slide in
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(dismiss, duration);
    },
    [slideY, opacity, dismiss],
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
      {config && <ToastBanner config={config} translateY={slideY} opacity={opacity} />}
    </ToastContext.Provider>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────
const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; color: string }> = {
  success: { bg: '#052e16', border: '#16a34a', color: '#4ade80' },
  error: { bg: '#450a0a', border: '#dc2626', color: '#f87171' },
  info: { bg: '#0c1a2e', border: '#3b82f6', color: '#93c5fd' },
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
}: {
  config: ToastConfig;
  translateY: Animated.Value;
  opacity: Animated.Value;
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
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Icon size={18} color={style.color} />
      <Text style={[styles.message, { color: '#f9fafb' }]} numberOfLines={2}>
        {config.message}
      </Text>
      <View style={[styles.accent, { backgroundColor: style.border }]} />
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
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
