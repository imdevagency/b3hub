/**
 * WhenStep — "Kad piegādāt?" step of the material order wizard.
 *
 * Inline calendar + day-window selector (Any / AM / PM).
 * Fully stateless — all values owned by the wizard root.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { CalendarClock, Sun, Moon, Zap as ZapIcon } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

export type WhenStepProps = {
  deliveryDate: string;
  onDateChange: (date: string) => void;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  onWindowChange: (w: 'ANY' | 'AM' | 'PM') => void;
};

export function WhenStep({
  deliveryDate,
  onDateChange,
  deliveryWindow,
  onWindowChange,
}: WhenStepProps) {
  return (
    <View className="px-6 pt-5 pb-12">
      {/* Inline calendar */}
      <View className="mb-10">
        <Text className="text-gray-900 text-base font-bold tracking-tight mb-4 ml-1">
          Piegādes datums
        </Text>
        <View className="bg-transparent">
          <RNCalendar
            current={deliveryDate || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            markedDates={
              deliveryDate
                ? {
                    [deliveryDate]: {
                      selected: true,
                      selectedColor: '#111827',
                      selectedTextColor: '#fff',
                    },
                  }
                : {}
            }
            onDayPress={(day: { dateString: string }) => {
              onDateChange(day.dateString);
              haptics.light();
            }}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: '#6b7280',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#111827',
              dayTextColor: '#111827',
              textDisabledColor: '#d1d5db',
              arrowColor: '#111827',
              monthTextColor: '#111827',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 13,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
            }}
            firstDay={1}
            enableSwipeMonths
          />
        </View>
      </View>

      {/* Time window selection */}
      <View className="mb-10">
        <Text className="text-gray-900 text-base font-bold tracking-tight mb-4 ml-1">
          Dienas laiks
        </Text>
        <View className="flex-row gap-3">
          {(
            [
              { id: 'ANY', label: 'Jebkurā laikā', icon: CalendarClock },
              { id: 'AM', label: 'Rīta pusē', icon: Sun },
              { id: 'PM', label: 'Pēcpusdienā', icon: Moon },
            ] as const
          ).map((w, i) => {
            const active = deliveryWindow === w.id;
            const Icon = w.icon;
            return (
              <TouchableOpacity
                key={i}
                className={`flex-1 rounded-2xl p-4 items-center justify-center ${
                  active ? 'bg-gray-900' : 'bg-gray-50'
                }`}
                onPress={() => onWindowChange(w.id)}
                activeOpacity={0.8}
              >
                <Icon size={20} color={active ? '#ffffff' : '#9ca3af'} className="mb-2" />
                <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-gray-500'}`}>
                  {w.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View className="flex-row items-center mt-2 mb-6 px-1">
        <ZapIcon size={16} color="#9ca3af" className="mr-3" />
        <View className="flex-1">
          <Text className="text-gray-500 flex-wrap font-medium text-xs leading-snug">
            Pārdevēji piedāvās labāko cenu atbilstoši izvēlētajam piegādes laikam.
          </Text>
        </View>
      </View>
    </View>
  );
}
