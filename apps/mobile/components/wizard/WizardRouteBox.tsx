/**
 * WizardRouteBox
 *
 * Uber-style pickup → dropoff route display used on the review/confirmation
 * step of any wizard that involves a route (transport, disposal, skip-hire, etc.).
 *
 * Usage:
 *   <WizardRouteBox
 *     pickup={pickupPicked?.address ?? 'Ielādes adrese'}
 *     dropoff={dropoffPicked?.address ?? 'Izkraušanas adrese'}
 *   />
 *
 * The component is intentionally presentational only — no tap handlers.
 * Wrap in a TouchableOpacity if you need tap-to-edit behaviour.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';

interface Props {
  pickup: string;
  dropoff: string;
  style?: StyleProp<ViewStyle>;
}

export function WizardRouteBox({ pickup, dropoff, style }: Props) {
  return (
    <View style={[s.box, style]}>
      {/* Timeline track */}
      <View style={s.timeline}>
        <View style={s.dot} />
        <View style={s.line} />
        <View style={s.square} />
      </View>

      {/* Address texts */}
      <View style={s.texts}>
        <View style={s.textRow}>
          <Text style={s.address} numberOfLines={1}>
            {pickup}
          </Text>
        </View>
        <View style={s.divider} />
        <View style={s.textRow}>
          <Text style={s.address} numberOfLines={1}>
            {dropoff}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    paddingVertical: 12,
    gap: 14,
    alignItems: 'center',
  },
  timeline: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    width: 14,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: '#d1d5db',
    borderRadius: 1,
  },
  square: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#111827',
  },
  texts: {
    flex: 1,
    gap: 0,
  },
  textRow: {
    paddingVertical: 8,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 2,
  },
  address: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },
});
