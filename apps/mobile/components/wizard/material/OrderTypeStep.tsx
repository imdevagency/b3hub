/**
 * OrderTypeStep — Step 1 of the material order wizard.
 *
 * Buyer selects Delivery (Piegāde) or Pickup (Paņemšana).
 * Auto-advances on tap — no need for a CTA button press.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Truck, MapPin, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

type FulfillmentType = 'DELIVERY' | 'PICKUP';

export type OrderTypeStepProps = {
  fulfillmentType: FulfillmentType;
  onSelect: (type: FulfillmentType) => void;
};

const OPTIONS: {
  id: FulfillmentType;
  Icon: React.ElementType;
  label: string;
  desc: string;
  tag?: string;
}[] = [
  {
    id: 'DELIVERY',
    Icon: Truck,
    label: 'Piegāde',
    desc: 'Materiāli tiek piegādāti uz jūsu objektu. Jūs norādāt adresi un laiku.',
  },
  {
    id: 'PICKUP',
    Icon: MapPin,
    label: 'Paņemšana',
    desc: 'Paņemiet materiālus no noliktavas pats sev ērtā laikā.',
    tag: 'Lētāk',
  },
];

export function OrderTypeStep({ fulfillmentType, onSelect }: OrderTypeStepProps) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          fontSize: 15,
          fontFamily: 'Inter_500Medium',
          color: '#6b7280',
          marginBottom: 28,
          lineHeight: 22,
        }}
      >
        Kā vēlaties saņemt materiālus?
      </Text>

      {OPTIONS.map((opt) => {
        const Icon = opt.Icon;
        const active = fulfillmentType === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => {
              haptics.medium();
              onSelect(opt.id);
            }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? '#111827' : '#fff',
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: active ? '#111827' : '#e5e7eb',
              padding: 20,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: active ? 6 : 1 },
              shadowOpacity: active ? 0.14 : 0.04,
              shadowRadius: active ? 14 : 4,
              elevation: active ? 6 : 2,
            }}
          >
            {/* Icon bubble */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: active ? 'rgba(255,255,255,0.12)' : '#f3f4f6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 18,
                flexShrink: 0,
              }}
            >
              <Icon size={26} color={active ? '#fff' : '#374151'} />
            </View>

            {/* Label + desc */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: 'Inter_700Bold',
                    color: active ? '#fff' : '#111827',
                    letterSpacing: -0.3,
                  }}
                >
                  {opt.label}
                </Text>
                {opt.tag && (
                  <View
                    style={{
                      backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#dcfce7',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter_700Bold',
                        color: active ? '#fff' : '#16a34a',
                      }}
                    >
                      {opt.tag}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Inter_400Regular',
                  color: active ? 'rgba(255,255,255,0.65)' : '#6b7280',
                  lineHeight: 19,
                }}
              >
                {opt.desc}
              </Text>
            </View>

            {/* Radio / arrow */}
            <View style={{ marginLeft: 12, flexShrink: 0 }}>
              {active ? (
                <ArrowRight size={20} color="rgba(255,255,255,0.7)" />
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: '#d1d5db',
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
