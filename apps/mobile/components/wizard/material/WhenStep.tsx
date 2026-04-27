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
          minDate={new Date().toISOString().split('T')[0]}
        />
      </View>

      {/* Time window selection */}
      <View className="mb-10">
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
                  active ? 'bg-[#F9423A]' : 'bg-gray-50'
                }`}
                onPress={() => {
                  haptics.light();
                  onWindowChange(w.id);
                }}
                activeOpacity={0.8}
              >
                <Icon size={20} color={active ? '#ffffff' : '#9ca3af'} className="mb-2" />
                <Text className={`font-semibold text-xs ${active ? 'text-white' : 'text-gray-500'}`}>
                  {w.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
