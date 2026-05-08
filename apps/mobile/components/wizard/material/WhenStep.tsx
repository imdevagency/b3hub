/**
 * WhenStep — "Kad piegādāt?" step of the material order wizard.
 *
 * Inline calendar + day-window selector (Any / AM / PM).
 * Fully stateless — all values owned by the wizard root.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Sun, Moon, CalendarClock } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';

const MIN_DATE = toISO(addDays(new Date(), 1));

export type WhenStepProps = {
  deliveryDate: string;
  onDateChange: (date: string) => void;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  onWindowChange: (w: 'ANY' | 'AM' | 'PM') => void;
  truckCount?: number;
  onTruckCountChange?: (n: number) => void;
  truckIntervalMinutes?: number;
  onTruckIntervalChange?: (n: number) => void;
};

export function WhenStep({
  deliveryDate,
  onDateChange,
  deliveryWindow,
  onWindowChange,
  truckCount = 1,
  onTruckCountChange,
  truckIntervalMinutes = 60,
  onTruckIntervalChange,
}: WhenStepProps) {
  return (
    <View className="px-6 pt-5 pb-12">
      {/* Inline calendar */}
      <View className="mb-6">
        <Text className="text-gray-900 text-base font-semibold tracking-tight mb-4 ml-1">
          Piegādes datums
        </Text>
        <WizardCalendar
          selectedDate={deliveryDate}
          onDateChange={(d) => {
            haptics.light();
            onDateChange(d);
          }}
          minDate={MIN_DATE}
        />
      </View>

      {/* Time window selection */}
      <View className="mb-6">
        <Text className="text-gray-900 text-base font-semibold tracking-tight mb-4 ml-1">
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
                  active ? 'bg-[#166534]' : 'bg-gray-50'
                }`}
                onPress={() => {
                  haptics.light();
                  onWindowChange(w.id);
                }}
                activeOpacity={0.8}
              >
                <Icon size={20} color={active ? '#ffffff' : '#9ca3af'} className="mb-2" />
                <Text
                  className={`font-semibold text-xs ${active ? 'text-white' : 'text-gray-500'}`}
                >
                  {w.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Truck count stepper — only shown when prop is wired */}
      {onTruckCountChange && (
        <View className="mb-10">
          <Text className="text-gray-900 text-base font-semibold tracking-tight mb-4 ml-1">
            Kravas auto skaits
          </Text>
          <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 gap-4">
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onTruckCountChange(Math.max(1, truckCount - 1));
              }}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-xl bg-white items-center justify-center"
              style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
            >
              <Text className="text-gray-900 text-xl font-semibold">−</Text>
            </TouchableOpacity>
            <Text className="flex-1 text-center text-gray-900 text-base font-semibold">
              {truckCount} {truckCount === 1 ? 'auto' : 'auto'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onTruckCountChange(Math.min(5, truckCount + 1));
              }}
              activeOpacity={0.7}
              className="w-10 h-10 rounded-xl bg-white items-center justify-center"
              style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
            >
              <Text className="text-gray-900 text-xl font-semibold">+</Text>
            </TouchableOpacity>
          </View>

          {/* Interval chips — only visible when >1 truck */}
          {truckCount > 1 && onTruckIntervalChange && (
            <View className="mt-3">
              <Text className="text-gray-500 text-xs mb-2 ml-1">Intervāls starp automašīnām</Text>
              <View className="flex-row gap-2">
                {([30, 60, 90, 120] as const).map((mins) => {
                  const active = truckIntervalMinutes === mins;
                  return (
                    <TouchableOpacity
                      key={mins}
                      onPress={() => {
                        haptics.light();
                        onTruckIntervalChange(mins);
                      }}
                      activeOpacity={0.75}
                      className={`flex-1 rounded-xl py-2 items-center ${active ? 'bg-[#166534]' : 'bg-gray-50'}`}
                      style={active ? undefined : { borderWidth: 1, borderColor: '#e5e7eb' }}
                    >
                      <Text
                        className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-500'}`}
                      >
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
