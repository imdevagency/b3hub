import React from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@/lib/theme';

interface Props {
  label: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Shared uppercase section label used across list and detail screens.
 * Matches the canonical grey uppercase heading style.
 */
export function SectionLabel({ label, style }: Props) {
  return <Text style={[s.label, style]}>{label}</Text>;
}

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
});
