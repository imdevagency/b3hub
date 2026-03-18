/**
 * WizardLayout — Shared shell for all B3 service-booking wizards.
 *
 * Renders:
 *   - Status bar (dark)
 *   - Header row: back chevron | centred title | optional close ✕
 *   - Step progress: pills (done = grey, active = wide black, todo = light)
 *   - Content slot (fills remaining space — caller must add ScrollView if needed)
 *   - Footer: single primary CTA button
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';

export type WizardLayoutProps = {
  /** Header title (centred). */
  title: string;
  /** 1-based current step index. */
  step: number;
  totalSteps: number;
  onBack: () => void;
  /** If provided, renders a close ✕ button on the right of the header. */
  onClose?: () => void;
  children: React.ReactNode;
  /** Primary CTA label. */
  ctaLabel: string;
  onCTA: () => void;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
};

export function WizardLayout({
  title,
  step,
  totalSteps,
  onBack,
  onClose,
  children,
  ctaLabel,
  onCTA,
  ctaDisabled,
  ctaLoading,
}: WizardLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[wl.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={wl.header}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={wl.iconBtn}>
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={wl.title} numberOfLines={1}>
          {title}
        </Text>

        {onClose ? (
          <TouchableOpacity onPress={onClose} hitSlop={10} style={wl.iconBtn}>
            <X size={19} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <View style={wl.iconBtn} />
        )}
      </View>

      {/* ── Progress pills ── */}
      <View style={wl.progressRow}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const done = i < step - 1;
          const active = i === step - 1;
          return <View key={i} style={[wl.pill, done && wl.pillDone, active && wl.pillActive]} />;
        })}
      </View>

      {/* ── Content ── */}
      <View style={wl.content}>{children}</View>

      {/* ── Footer CTA ── */}
      <View style={[wl.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          style={[wl.cta, ctaDisabled && wl.ctaDisabled]}
          disabled={!!(ctaDisabled || ctaLoading)}
          onPress={onCTA}
          activeOpacity={0.85}
        >
          {ctaLoading ? (
            <ActivityIndicator color={ctaDisabled ? '#9ca3af' : '#fff'} />
          ) : (
            <Text style={[wl.ctaText, ctaDisabled && wl.ctaTextDisabled]}>{ctaLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const wl = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },

  // progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pill: {
    height: 5,
    width: 20,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
  },
  pillDone: { backgroundColor: '#9ca3af' },
  pillActive: { width: 32, backgroundColor: '#111827' },

  // content
  content: { flex: 1 },

  // footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  cta: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#f3f4f6' },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  ctaTextDisabled: { color: '#9ca3af' },
});
