import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { t } from '@/lib/translations';
import { toISO, formatShort } from './skip-hire-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build period-marked dates for react-native-calendars `markingType='period'`. */
function buildPeriodMarks(
  start: string | null,
  end: string | null,
): Record<
  string,
  { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }
> {
  if (!start) return {};
  if (!end) {
    return {
      [start]: { startingDay: true, endingDay: true, color: '#111827', textColor: '#fff' },
    };
  }
  const marks: Record<
    string,
    { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }
  > = {};
  // Parse with local Date constructor (year, month-1, day) to avoid UTC offset shifts
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let cur = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);
  while (cur <= endD) {
    const iso = toISO(cur);
    marks[iso] = {
      color: '#111827',
      textColor: '#fff',
      startingDay: iso === start,
      endingDay: iso === end,
    };
    // Advance by one day using local time
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return marks;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Step4Date({
  minDate,
  startDate,
  endDate,
  onRangeChange,
  wasteLabel,
  sizeLabel,
  location,
}: {
  minDate: string;
  startDate: string | null;
  endDate: string | null;
  onRangeChange: (start: string | null, end: string | null) => void;
  wasteLabel: string;
  sizeLabel: string;
  location: string;
}) {
  const handleDayPress = (day: { dateString: string }) => {
    const iso = day.dateString;
    if (!startDate || (startDate && endDate)) {
      // Start fresh selection
      onRangeChange(iso, null);
    } else {
      // Have start, waiting for end
      if (iso < startDate) {
        onRangeChange(iso, null); // tapped before start → new start
      } else if (iso === startDate) {
        onRangeChange(null, null); // deselect
      } else {
        onRangeChange(startDate, iso); // complete the range
      }
    }
  };

  const markedDates = buildPeriodMarks(startDate, endDate);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Range calendar */}
      <Calendar
        minDate={minDate}
        current={startDate ?? minDate}
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          calendarBackground: '#fff',
          backgroundColor: '#fff',
          selectedDayBackgroundColor: '#111827',
          selectedDayTextColor: '#fff',
          todayTextColor: '#6b7280',
          dayTextColor: '#111827',
          textDisabledColor: '#d1d5db',
          arrowColor: '#111827',
          monthTextColor: '#111827',
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 15,
        }}
        style={s4.calendar}
        enableSwipeMonths
      />

      {/* Order summary */}
      <Text style={s4.summTitle}>{t.skipHire.step4.summary}</Text>
      <View style={s4.summary}>
        {[
          { label: t.skipHire.confirmation.location, value: location },
          { label: t.skipHire.confirmation.wasteType, value: wasteLabel },
          { label: t.skipHire.confirmation.size, value: sizeLabel },
          {
            label: 'Nomas periods',
            value:
              startDate && endDate ? `${formatShort(startDate)} – ${formatShort(endDate)}` : '—',
          },
        ].map((row, i, arr) => (
          <View
            key={i}
            style={[
              s4.summRow,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
            ]}
          >
            <Text style={s4.summLabel}>{row.label}</Text>
            <Text style={s4.summVal} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s4 = StyleSheet.create({
  calendar: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summary: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  summRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  summLabel: { fontSize: 13, color: '#6b7280' },
  summVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
