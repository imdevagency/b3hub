import React from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

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
    color: '#6b7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
});
