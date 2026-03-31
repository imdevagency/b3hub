import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { HardHat, Package, Trash2, Truck } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { haptics } from '@/lib/haptics';

// ── Service definitions ────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
// Screen width minus padding (16*2=32) minus gap (16) divided by 2 items per row
const cardWidth = (width - 48) / 2;

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    route: '/(buyer)/catalog',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    route: '/transport',
  },
] as const;

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NewOrderScreen() {
  const router = useRouter();

  return (
    <ScreenContainer standalone bg="#ffffff">
      <ScreenHeader title="Jauns pasūtījums" style={{ backgroundColor: '#ffffff' }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap justify-between" style={{ gap: 16 }}>
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={svc.id}
                className="bg-card rounded-2xl p-4 justify-between"
                activeOpacity={0.7}
                style={{
                  width: cardWidth,
                  aspectRatio: 1, // Make them perfect squares
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: '#F9FAFB',
                }}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as any);
                }}
              >
                <Text
                  className="text-text-primary text-lg font-semibold tracking-tight"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {svc.label}
                </Text>

                <View className="self-end mt-auto bg-subtle p-3 rounded-full">
                  <Icon size={32} color="#111827" strokeWidth={1.5} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
