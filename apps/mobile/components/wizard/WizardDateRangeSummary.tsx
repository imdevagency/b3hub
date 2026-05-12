/**
 * WizardDateRangeSummary
 *
 * The "Piegāde → Savākšana" summary card shared across all hire-period wizards
 * (skip-hire, toilet-cabin, etc.). Shows start date on the left, end date on
 * the right with an arrow between. Grays out empty slots.
 *
 * Usage:
 *   <WizardDateRangeSummary
 *     startDate={selectedDay}
 *     endDate={collectionDay}
 *     dayCount={hireDays}
 *   />
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowRight } from 'lucide-react-native';

interface Props {
  /** ISO date string e.g. '2026-06-01', or null if not yet selected */
  startDate: string | null;
  /** ISO date string for the end / collection date, or null */
  endDate: string | null;
  /** Number of days in the hire period — shown next to the end-label */
  dayCount?: number;
  /** Override label above the start date. Defaults to 'Piegāde' */
  startLabel?: string;
  /** Override label above the end date. Defaults to 'Savākšana' */
  endLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function WizardDateRangeSummary({
  startDate,
  endDate,
  dayCount,
  startLabel = 'Piegāde',
  endLabel = 'Savākšana',
  style,
}: Props) {
  const endLabelFull = endLabel + (dayCount && endDate ? ` · ${dayCount} d.` : '');

  return (
    <View style={[s.card, style]}>
      {/* Start */}
      <View style={s.col}>
        <Text style={s.label}>{startLabel}</Text>
        <Text style={[s.date, !startDate && s.dateEmpty]}>
          {startDate ? fmtShort(startDate) : 'Izvēlieties'}
        </Text>
      </View>

      {/* Divider */}
      <View style={s.arrow}>
        <ArrowRight size={16} color="#D1D5DB" />
      </View>

      {/* End */}
      <View style={[s.col, s.colRight]}>
        <Text style={s.label}>{endLabelFull}</Text>
        <Text style={[s.date, !endDate && s.dateEmpty]}>{endDate ? fmtShort(endDate) : '—'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  col: { flex: 1 },
  colRight: { alignItems: 'flex-end' },
  arrow: { paddingHorizontal: 14 },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  dateEmpty: { color: '#9CA3AF' },
});
