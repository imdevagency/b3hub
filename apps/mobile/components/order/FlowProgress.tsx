import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Step } from './order-request-types';
import { colors } from '@/lib/theme';

export const STEP_ORDER: Step[] = ['map', 'material', 'configure', 'offers', 'confirm'];

export function FlowProgress({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0) return null;
  return (
    <View style={s.progressRow}>
      {STEP_ORDER.map((st, i) => (
        <React.Fragment key={st}>
          <View style={[s.progressDot, i <= idx ? s.progressDotActive : s.progressDotInactive]}>
            {i < idx ? (
              <Text style={s.progressCheck}>✓</Text>
            ) : (
              <Text
                style={[s.progressNum, i === idx ? s.progressNumActive : s.progressNumInactive]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          {i < STEP_ORDER.length - 1 && (
            <View
              style={[s.progressLine, i < idx ? s.progressLineActive : s.progressLineInactive]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: colors.primary },
  progressDotInactive: { backgroundColor: colors.bgMuted },
  progressNum: { fontSize: 11, fontWeight: '700' },
  progressNumActive: { color: '#fff' },
  progressNumInactive: { color: colors.textDisabled },
  progressCheck: {},
  progressLine: { flex: 1, height: 2, marginHorizontal: 3 },
  progressLineActive: { backgroundColor: colors.primary },
  progressLineInactive: { backgroundColor: '#e5e7eb' },
});
