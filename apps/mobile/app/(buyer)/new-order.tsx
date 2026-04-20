import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { HardHat, Package, Trash2, Truck } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { haptics } from '@/lib/haptics';

// ── Service definitions ────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    sub: 'Smiltis, grants, šķembas, betona izstrādājumi',
    route: '/order-request-new',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    sub: 'Konteiners uz vietas — jūs piepildāt, mēs aizvedām',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    sub: 'Kravas auto iebrauc, iekrauj un aizved atkritumus',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    sub: 'Kravu pārvadāšana no A uz B',
    route: '/transport',
  },
] as const;

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NewOrderScreen() {
  const router = useRouter();

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title="Jauns pasūtījums" />
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
                  minHeight: cardWidth * 1.1,
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
                  router.push(svc.route);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    className="text-text-primary text-base font-semibold tracking-tight"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    {svc.label}
                  </Text>
                  <Text
                    className="text-text-muted text-xs mt-1 leading-4"
                    style={{ fontFamily: 'Inter_400Regular' }}
                    numberOfLines={3}
                  >
                    {svc.sub}
                  </Text>
                </View>

                <View className="self-end mt-3 bg-subtle p-3 rounded-full">
                  <Icon size={28} color="#111827" strokeWidth={1.5} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
