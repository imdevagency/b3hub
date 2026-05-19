/**
 * RentalHirePeriodStep — shared hire period step for all rental service wizards.
 *
 * Encapsulates:
 *   - Predefined period chips (3 d, 1 ned, 2 ned, ...)
 *   - WizardCalendar with range highlight (delivery → collection)
 *   - WizardDateRangeSummary
 *   - WizardTimeWindowPicker
 *
 * Used by: skip-hire wizard, toilet-cabin wizard, and all future rental wizards.
 *
 * Props:
 *   selectedDay        — ISO delivery date string (e.g. '2026-06-01')
 *   collectionDay      — ISO collection date string (derived from selectedDay + hireDays)
 *   hireDays           — number of hire days
 *   deliveryWindow     — 'ANY' | 'AM' | 'PM'
 *   onDayPress         — called with an ISO date string on calendar tap
 *   onHireDaysChange   — called with new hireDays value when a chip is pressed
 *   onWindowChange     — called with new delivery window
 *   periodOptions      — array of { days, label } chips to show
 *   minDate            — ISO string for earliest selectable date (default: tomorrow)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { WizardDateRangeSummary } from '@/components/wizard/WizardDateRangeSummary';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { WizardSectionHeading } from '@/components/wizard/WizardSectionHeading';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';

// ── Types ─────────────────────────────────────────────────────────

export interface PeriodOption {
  days: number;
  label: string;
}

type DeliveryWindow = 'ANY' | 'AM' | 'PM';

interface Props {
  selectedDay: string | null;
  collectionDay: string | null;
  hireDays: number;
  deliveryWindow: DeliveryWindow;
  onDayPress: (iso: string) => void;
  onHireDaysChange: (days: number) => void;
  onWindowChange: (w: DeliveryWindow) => void;
  periodOptions?: PeriodOption[];
  minDate?: string;
}

// ── Default period options (matches skip-hire convention) ─────────

const DEFAULT_PERIODS: PeriodOption[] = [
  { days: 3, label: '3 dienas' },
  { days: 7, label: '1 nedēļa' },
  { days: 14, label: '2 nedēļas' },
  { days: 30, label: '1 mēnesis' },
  { days: 60, label: '2 mēneši' },
  { days: 90, label: '3 mēneši' },
];

const tomorrow = toISO(addDays(new Date(), 1));

// ── Component ─────────────────────────────────────────────────────

export function RentalHirePeriodStep({
  selectedDay,
  collectionDay,
  hireDays,
  deliveryWindow,
  onDayPress,
  onHireDaysChange,
  onWindowChange,
  periodOptions = DEFAULT_PERIODS,
  minDate = tomorrow,
}: Props) {
  return (
    <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      {/* Hire period chips */}
      <WizardSectionHeading label="Nomas periods" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
      >
        {periodOptions.map((opt) => {
          const isActive = hireDays === opt.days;
          return (
            <TouchableOpacity
              key={opt.days}
              style={[s.chip, isActive && s.chipActive]}
              onPress={() => {
                haptics.light();
                onHireDaysChange(opt.days);
              }}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, isActive && s.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Calendar */}
      <WizardSectionHeading label="Piegādes datums" />
      <WizardCalendar
        selectedDate={selectedDay ?? ''}
        rangeEndDate={collectionDay ?? undefined}
        minDate={minDate}
        onDateChange={onDayPress}
      />

      {/* Date range summary pill */}
      {selectedDay && collectionDay ? (
        <WizardDateRangeSummary
          startDate={selectedDay}
          endDate={collectionDay}
          dayCount={hireDays}
        />
      ) : null}

      {/* Delivery window */}
      <WizardSectionHeading label="Piegādes laiks" />
      <WizardTimeWindowPicker value={deliveryWindow} onChange={onWindowChange} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
});
