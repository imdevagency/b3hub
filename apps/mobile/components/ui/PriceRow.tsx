/**
 * PriceRow — A single label + formatted price line for price breakdowns.
 *
 * Replaces the repeated pattern:
 *   <View style={m.lineItem}>
 *     <Text style={m.lineLabel}>Summa bez PVN</Text>
 *     <Text style={m.lineVal}>{fmtEur(inv.subtotal)}</Text>
 *   </View>
 *
 * Also covers the "total" variant which renders bold text on both sides.
 *
 * Usage:
 *   <PriceRow label="Summa bez PVN" amount={order.subtotal} />
 *   <PriceRow label="PVN (21%)"     amount={order.tax} />
 *   <PriceRow label="Piegāde"       amount={order.deliveryFee} />
 *   <PriceRow label="Kopā" amount={order.total} total />
 *
 *   // Custom formatted value (non-currency):
 *   <PriceRow label="Daudzums" value="12 t" />
 *
 *   // Highlighted value (e.g. overdue):
 *   <PriceRow label="Termiņš" value="15. maijs" valueColor="#dc2626" />
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

interface PriceRowProps {
  label: string;
  /** Numeric amount — formatted as €X.XX. Provide either `amount` or `value`. */
  amount?: number;
  /** Pre-formatted string value. Overrides `amount` formatting. */
  value?: string;
  /** Renders both label and value in bold; used for total rows. */
  total?: boolean;
  /** Override the value text colour (e.g. for overdue amounts). */
  valueColor?: string;
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function PriceRow({ label, amount, value, total = false, valueColor }: PriceRowProps) {
  const displayValue = value ?? (amount !== undefined ? fmtEur(amount) : '—');

  return (
    <View style={[styles.row, total && styles.rowTotal]}>
      <Text style={[styles.label, total && styles.labelTotal]}>{label}</Text>
      <Text
        style={[
          styles.value,
          total && styles.valueTotal,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {displayValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 12,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    flex: 1,
  },
  labelTotal: {
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 15,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    textAlign: 'right',
  },
  valueTotal: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    fontSize: 15,
  },
});
