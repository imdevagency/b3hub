/**
 * WizardSectionHeading
 *
 * Bold section title row used in wizard confirmation/review steps.
 * Optionally renders a leading icon (any React node — pass a lucide icon).
 *
 * Usage:
 *   import { Bookmark } from 'lucide-react-native';
 *   <WizardSectionHeading label="Kontaktinformācija" icon={<Bookmark size={16} color="#111827" />} />
 *   <WizardSectionHeading label="Maksājuma veids" style={{ marginTop: 24 }} />
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  label: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function WizardSectionHeading({ label, icon, style }: Props) {
  return (
    <View style={[s.row, style]}>
      {icon != null && <View style={s.iconWrap}>{icon}</View>}
      <Text style={s.text}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: { marginRight: 8 },
  text: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
});
