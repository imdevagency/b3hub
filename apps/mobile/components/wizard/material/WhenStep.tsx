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

      {/* Truck count stepper — only shown when prop is wired */}
      {onTruckCountChange && (
        <View className="mb-10">
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
              fontWeight: '600',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 16,
              marginLeft: 4,
            }}
          >
            Kravas auto skaits
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f3f4f6',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onTruckCountChange(Math.max(1, truckCount - 1));
              }}
              activeOpacity={0.7}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 22, fontFamily: 'Inter_400Regular', color: '#111827' }}>
                −
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 18,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#111827',
              }}
            >
              {truckCount} {truckCount === 1 ? 'auto' : 'auto'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onTruckCountChange(Math.min(5, truckCount + 1));
              }}
              activeOpacity={0.7}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 22, fontFamily: 'Inter_400Regular', color: '#111827' }}>
                +
              </Text>
            </TouchableOpacity>
          </View>

          {/* Interval chips — only visible when >1 truck */}
          {truckCount > 1 && onTruckIntervalChange && (
            <View className="mt-3">
              <Text
                style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Intervāls starp automašīnām
              </Text>
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
                      style={{
                        flex: 1,
                        borderRadius: 999,
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: active ? '#111827' : '#f3f4f6',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                          fontWeight: active ? '700' : '500',
                          color: active ? '#fff' : '#4b5563',
                        }}
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
