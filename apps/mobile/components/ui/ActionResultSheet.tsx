/**
 * ActionResultSheet — reusable post-action feedback bottom sheet.
 *
 * Slides up from the bottom after a significant user action.
 * Provides a deliberate "moment" between action and next step —
 * avoids the silent state-update pattern.
 *
 * Usage:
 *   <ActionResultSheet
 *     visible={showResult}
 *     variant="cancelled"
 *     title="Pasūtījums atcelts"
 *     subtitle="Jūs vienmēr varat pasūtīt materiālus no jauna."
 *     primaryLabel="Pasūtīt no jauna"
 *     onPrimary={() => { setShowResult(false); router.push('/order-request-new'); }}
 *     secondaryLabel="Mani pasūtījumi"
 *     onSecondary={() => { setShowResult(false); router.back(); }}
 *     onClose={() => setShowResult(false)}
 *   />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { colors, spacing, radius, fontSizes } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResultVariant = 'success' | 'cancelled' | 'warning' | 'info';

export interface ActionResultSheetProps {
  visible: boolean;
  onClose: () => void;
  variant: ActionResultVariant;
  title: string;
  subtitle?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// ── Config per variant ─────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ActionResultVariant,
  { iconBg: string; iconColor: string; Icon: React.ComponentType<{ size: number; color: string }> }
> = {
  success: {
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    Icon: CheckCircle2,
  },
  cancelled: {
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    Icon: XCircle,
  },
  warning: {
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    Icon: AlertCircle,
  },
  info: {
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    Icon: Info,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ActionResultSheet({
  visible,
  onClose,
  variant,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: ActionResultSheetProps) {
  const { iconBg, iconColor, Icon } = VARIANT_CONFIG[variant];

  return (
    <BottomSheet visible={visible} onClose={onClose} hideHandle>
      <View style={s.container}>
        {/* Icon circle */}
        <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
          <Icon size={36} color={iconColor} />
        </View>

        {/* Text */}
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: iconColor }]}
          onPress={onPrimary}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>

        {/* Secondary link */}
        {secondaryLabel ? (
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={onSecondary ?? onClose}
            activeOpacity={0.7}
          >
            <Text style={[s.secondaryBtnText, { color: iconColor }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
