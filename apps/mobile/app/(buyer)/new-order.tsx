import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { HardHat, Package, Trash2, Truck, ChevronRight } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { haptics } from '@/lib/haptics';

// ── Service definitions ────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    label: 'Materiāli',
    description: 'Grants, smilts, betons — piegāde uz būvlaukumu',
    route: '/(buyer)/catalog',
  },
  {
    id: 'container',
    icon: Package,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    label: 'Konteineri',
    description: 'Pasūtīt atkritumu konteineru — izvešana 24 h laikā',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    label: 'Utilizācija',
    description: 'Nodot celtniecības atkritumus pārstrādei',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    label: 'Transports',
    description: 'Pasūtīt pārvadājumu starp diviem punktiem',
    route: '/transport',
  },
] as const;

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NewOrderScreen() {
  const router = useRouter();

  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Jauns pasūtījums" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-text-muted text-sm mb-base">
          Izvēlies pakalpojuma veidu, ko vēlies pasūtīt.
        </Text>
        <View className="gap-sm">
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={svc.id}
                className="bg-card rounded-lg border border-border flex-row items-center p-base gap-base"
                activeOpacity={0.75}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as any);
                }}
              >
                {/* Icon pill */}
                <View
                  className="rounded-md items-center justify-center"
                  style={{ width: 48, height: 48, backgroundColor: svc.iconBg }}
                >
                  <Icon size={24} color={svc.iconColor} strokeWidth={2} />
                </View>

                {/* Text */}
                <View className="flex-1">
                  <Text className="text-text-primary text-base font-semibold">{svc.label}</Text>
                  <Text className="text-text-muted text-sm mt-xs" numberOfLines={2}>
                    {svc.description}
                  </Text>
                </View>

                <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
