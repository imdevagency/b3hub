/**
 * WizardSummaryCard
 *
 * Consistent receipt-style bordered card used on the final "review" step
 * of every wizard. Provides the shared visual container — children are
 * <DetailRow> items rendered inside it.
 *
 * Usage:
 *   <WizardSummaryCard>
 *     <DetailRow label="Adrese" value={address} />
 *     <DetailRow label="Datums" value={date} last />
 *   </WizardSummaryCard>
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function WizardSummaryCard({ children, style }: Props) {
  return <View style={[s.card, style]}>{children}</View>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    paddingBottom: 8,
    overflow: 'hidden',
  },
});
