/**
 * WizardTimeWindowPicker
 *
 * Consistent AM / PM / ANY time-window chip row used across all wizards.
 *
 * Usage:
 *   <WizardTimeWindowPicker
 *     value={pickupWindow}
 *     onChange={setPickupWindow}
 *   />
 *
 * Optionally override chip labels via `labels` prop.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

type Window = 'ANY' | 'AM' | 'PM';

interface Props {
  value: Window;
  onChange: (val: Window) => void;
  /** Override default Latvian labels if needed */
  labels?: { ANY?: string; AM?: string; PM?: string };
}

const DEFAULT_LABELS: Record<Window, string> = {
  ANY: 'Jebkurā laikā',
  AM: 'Rīts 8–12',
  PM: 'Diena 12–17',
};

const WINDOWS: Window[] = ['ANY', 'AM', 'PM'];

export function WizardTimeWindowPicker({ value, onChange, labels }: Props) {
  const resolved = { ...DEFAULT_LABELS, ...labels };
  return (
    <View style={s.row}>
      {WINDOWS.map((w) => (
        <TouchableOpacity
          key={w}
          style={[s.chip, value === w && s.chipActive]}
          onPress={() => {
            haptics.light();
            onChange(w);
          }}
          activeOpacity={0.75}
        >
          <Text style={[s.chipText, value === w && s.chipTextActive]}>{resolved[w]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  chip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#111827' },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  chipTextActive: { color: '#fff' },
});
