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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MIN_DATE = toISO(addDays(new Date(), 1));

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
    <View className="px-6 pt-5 pb-6">
      {/* Inline calendar */}
      <View className="mb-6">
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
                onPress={() => {
                  haptics.light();
                  onWindowChange(w.id);
                }}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  borderRadius: 20,
                  paddingVertical: 18,
                  paddingHorizontal: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: active ? '#111827' : '#f3f4f6',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: active ? 4 : 1 },
                  shadowOpacity: active ? 0.15 : 0.04,
                  shadowRadius: active ? 10 : 4,
                  elevation: active ? 4 : 1,
                }}
              >
                <Icon size={22} color={active ? '#ffffff' : '#6b7280'} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                    fontWeight: active ? '700' : '500',
                    color: active ? '#fff' : '#4b5563',
                    textAlign: 'center',
                  }}
                >
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
