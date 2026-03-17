/**
 * StatusPill — Compact coloured pill for displaying a status label.
 *
 * Replaces the repeated `<View style={[s.badge, {backgroundColor: bg}]}> +
 * <Text style={{color}}>` pattern scattered across every list and detail screen.
 *
 * Usage:
 *   <StatusPill label="Piegādāts" bg="#dcfce7" color="#15803d" />
 *   <StatusPill label="Gaida"     bg="#f3f4f6" color="#6b7280" size="sm" />
 *
 *   // With a pre-built status map entry:
 *   const st = STATUS_MAP[order.status];
 *   <StatusPill label={st.label} bg={st.bg} color={st.color} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusPillProps {
  label: string;
  bg: string;
  color: string;
  /**
   * 'md' (default) — standard pill, e.g. header badges and card headers.
   * 'sm'           — compact pill, e.g. inside list rows.
   */
  size?: 'sm' | 'md';
}

export function StatusPill({ label, bg, color, size = 'md' }: StatusPillProps) {
  const pillStyle = size === 'sm' ? styles.pillSm : styles.pillMd;
  const textStyle = size === 'sm' ? styles.textSm : styles.textMd;
  return (
    <View style={[styles.pill, pillStyle, { backgroundColor: bg }]}>
      <Text style={[styles.text, textStyle, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 10 },
  pillMd: { paddingHorizontal: 10, paddingVertical: 4 },
  pillSm: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  text: { fontWeight: '700' },
  textMd: { fontSize: 12 },
  textSm: { fontSize: 11 },
});
