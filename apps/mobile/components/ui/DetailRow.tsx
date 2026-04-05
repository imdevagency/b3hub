/**
 * DetailRow — A label + value pair used in detail/summary sections.
 * Renders nothing when value is falsy (null, undefined, empty string).
 *
 * Extracted from the local `Row` helper that lived only in buyer/order/[id].tsx.
 * Now usable in any detail screen — order, job, skip, invoice, etc.
 *
 * Usage:
 *   <DetailRow label="Adrese"  value={order.deliveryAddress} />
 *   <DetailRow label="Pilsēta" value={order.deliveryCity} />
 *   <DetailRow label="Datums"  value={formatDate(order.deliveryDate)} last />
 *
 * Props:
 *   label — left-aligned label text.
 *   value — right-aligned value text; if falsy the row is not rendered.
 *   last  — when true, removes the bottom border (avoids double-border with parent).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DetailRowProps {
  label: string;
  value?: React.ReactNode;
  /** Removes the bottom border — use on the last row inside an InfoSection. */
  last?: boolean;
}

export function DetailRow({ label, value, last = false }: DetailRowProps) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <View style={styles.valueNode}>{value}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 13, color: '#6b7280', flex: 1 },
  value: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' },
  valueNode: { flex: 2, alignItems: 'flex-end' },
});
