/**
 * WizardCalendar — shared styled calendar for all booking wizards.
 *
 * Registers the Latvian locale once (module-level side-effect) so any
 * wizard that imports this file gets correct Latvian month/day names
 * regardless of which wizard was loaded first.
 *
 * Uses Inter fonts (matching the rest of the wizard UI — not Geist).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { colors } from '@/lib/theme';

// ── Latvian locale (registered once at module load) ──────────────
LocaleConfig.locales['lv'] = {
  monthNames: [
    'Janvāris',
    'Februāris',
    'Marts',
    'Aprīlis',
    'Maijs',
    'Jūnijs',
    'Jūlijs',
    'Augusts',
    'Septembris',
    'Oktobris',
    'Novembris',
    'Decembris',
  ],
  monthNamesShort: [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'Mai',
    'Jūn.',
    'Jūl.',
    'Aug.',
    'Sep.',
    'Okt.',
    'Nov.',
    'Dec.',
  ],
  dayNames: [
    'Svētdiena',
    'Pirmdiena',
    'Otrdiena',
    'Trešdiena',
    'Ceturtdiena',
    'Piektdiena',
    'Sestdiena',
  ],
  dayNamesShort: ['Sv', 'P', 'O', 'T', 'C', 'Pk', 'S'],
  today: 'Šodien',
};
LocaleConfig.defaultLocale = 'lv';

// ── Stable theme object (defined outside component to avoid re-renders) ──
const CALENDAR_THEME = {
  calendarBackground: '#ffffff',
  textSectionTitleColor: '#6B7280',
  selectedDayBackgroundColor: '#111827',
  selectedDayTextColor: '#ffffff',
  todayTextColor: '#2563EB',
  dayTextColor: '#111827',
  textDisabledColor: '#D1D5DB',
  dotColor: '#2563EB',
  selectedDotColor: '#ffffff',
  arrowColor: '#111827',
  monthTextColor: '#111827',
  // Use Inter (loaded via expo-google-fonts) — not Geist
  textDayFontFamily: 'Inter_500Medium',
  textMonthFontFamily: 'Inter_600SemiBold',
  textDayHeaderFontFamily: 'Inter_500Medium',
  textDayFontSize: 15,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 13,
} as const;

type Props = {
  /** ISO date string e.g. '2026-04-25'. */
  selectedDate: string;
  onDateChange: (date: string) => void;
  /**
   * Earliest selectable date (ISO string).
   * Defaults to today — pass `toISO(addDays(new Date(), 1))` for next-day minimum.
   */
  minDate?: string;
};

export function WizardCalendar({ selectedDate, onDateChange, minDate }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const current = selectedDate || today;

  return (
    <View style={s.wrapper}>
      <Calendar
        current={current}
        onDayPress={(day: { dateString: string }) => onDateChange(day.dateString)}
        markedDates={{ [current]: { selected: true, selectedColor: '#111827' } }}
        theme={CALENDAR_THEME}
        minDate={minDate ?? today}
        firstDay={1}
        enableSwipeMonths
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
