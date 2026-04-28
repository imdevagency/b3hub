/**
 * FulfillmentStep — step to choose DELIVERY vs PICKUP (B3 Field)
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Truck, MapPin } from 'lucide-react-native';
import { colors, radius, spacing } from '@/lib/theme';

interface Props {
  value: 'DELIVERY' | 'PICKUP';
  onChange: (v: 'DELIVERY' | 'PICKUP') => void;
}

const OPTIONS: {
  id: 'DELIVERY' | 'PICKUP';
  label: string;
  sub: string;
  bullet: string[];
  Icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    id: 'DELIVERY',
    label: 'Piegāde uz objektu',
    sub: 'Kravas auto nogādā materiālu tieši uz norādīto adresi.',
    bullet: [
      'Norādīsi piegādes adresi',
      'Izvēlēsies datumu un laiku',
      'Piegādātājs izvēlēsies auto',
    ],
    Icon: Truck,
    color: colors.primary,
    bg: '#F0FBF7',
  },
  {
    id: 'PICKUP',
    label: 'Paņemt pašam — B3 Field',
    sub: 'Izbrauc uz tuvāko B3 Field punktu un paņem materiālu ar savu transportu.',
    bullet: [
      'Izvēlēsies punktu un laika logu',
      'QR caurlaidi saņemsi uzreiz',
      'Nav piegādes maksas',
    ],
    Icon: MapPin,
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
];

export function FulfillmentStep({ value, onChange }: Props) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 14,
          color: colors.textMuted,
          marginBottom: spacing.base,
          lineHeight: 20,
        }}
      >
        Kā vēlaties saņemt materiālu?
      </Text>
      <View style={{ gap: spacing.sm }}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          const Icon = opt.Icon;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={{
                borderWidth: 2,
                borderColor: selected ? opt.color : colors.border,
                borderRadius: radius.lg,
                backgroundColor: selected ? opt.bg : colors.bgCard,
                padding: spacing.base,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: selected ? opt.color + '22' : colors.bgMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={22} color={selected ? opt.color : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter_600SemiBold',
                        color: colors.textPrimary,
                      }}
                    >
                      {opt.label}
                    </Text>
                    {opt.id === 'PICKUP' && (
                      <View
                        style={{
                          backgroundColor: '#FEF3C7',
                          borderRadius: 100,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: 'Inter_600SemiBold',
                            color: '#92400E',
                          }}
                        >
                          JAUNS
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      lineHeight: 18,
                      marginBottom: spacing.sm,
                    }}
                  >
                    {opt.sub}
                  </Text>
                  <View style={{ gap: 4 }}>
                    {opt.bullet.map((b, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: selected ? opt.color : colors.textDisabled,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            color: selected ? colors.textSecondary : colors.textDisabled,
                            fontFamily: 'Inter_400Regular',
                          }}
                        >
                          {b}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                {/* Radio dot */}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: selected ? opt.color : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {selected && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: opt.color,
                      }}
                    />
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
