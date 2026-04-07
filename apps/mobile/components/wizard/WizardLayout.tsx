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
/**
 * WizardLayout — Shared shell for all B3 service-booking wizards.
 *
 * Uber-like design:
 *   - Thin progress bar at the very top (tracks step/totalSteps)
 *   - Minimal header: back chevron only on left, optional close ✕ on right, no title text
 *   - Title area: small "Step X of Y" caption + large bold left-aligned step title
 *   - Content slot (fills remaining space — caller must add ScrollView if needed)
 *   - Footer: full-width pill CTA button, no top border
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
  /** Step title shown below the header, large + left-aligned. */
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
  /** Optional custom content to left of CTA in footer */
  footerLeft?: React.ReactNode;
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
  footerLeft,
}: WizardLayoutProps) {
  const insets = useSafeAreaInsets();
  const progressPct = `${Math.round((step / totalSteps) * 100)}%`;

  return (
    <View style={[wl.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Thin progress bar ── */}
      <View style={wl.progressTrack}>
        <View style={[wl.progressFill, { width: progressPct as any }]} />
      </View>

      {/* ── Header (icons only — no title text) ── */}
      <View style={wl.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={wl.iconBtn}>
          <ChevronLeft size={24} color="#111827" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {onClose ? (
          <TouchableOpacity onPress={onClose} hitSlop={12} style={wl.iconBtn}>
            <X size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : (
          <View style={wl.iconBtn} />
        )}
      </View>

      {/* ── Step label + Title ── */}
      <View style={wl.titleArea}>
        <Text style={wl.stepCaption}>
          Solis {step} no {totalSteps}
        </Text>
        <Text style={wl.title} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {/* ── Content ── */}
      <View style={wl.content}>{children}</View>

      {/* ── Footer CTA ── */}
      <View style={[wl.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {footerLeft && <View style={{ flexShrink: 1 }}>{footerLeft}</View>}
          <TouchableOpacity
            style={[
              wl.cta,
              { flex: footerLeft ? 1 : undefined, width: footerLeft ? undefined : '100%' },
              ctaDisabled && wl.ctaDisabled,
            ]}
            disabled={!!(ctaDisabled || ctaLoading)}
            onPress={onCTA}
            activeOpacity={0.88}
          >
            {ctaLoading ? (
              <ActivityIndicator color={ctaDisabled ? '#9ca3af' : '#fff'} />
            ) : (
              <Text style={[wl.ctaText, ctaDisabled && wl.ctaTextDisabled]}>{ctaLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const wl = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // progress bar — thin line at the very top, fills proportionally
  progressTrack: {
    height: 3,
    backgroundColor: '#f3f4f6',
    width: '100%',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#111827',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // header — icons only, no title text
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // title area — left-aligned, below header
  titleArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  stepCaption: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#9ca3af',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    letterSpacing: -1,
    lineHeight: 38,
  },

  // content
  content: { flex: 1 },

  // footer — pill CTA, no top border
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
  },
  cta: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaDisabled: {
    backgroundColor: '#F4F5F7',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  ctaTextDisabled: { color: '#9ca3af' },
});
