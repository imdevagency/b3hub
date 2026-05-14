/**
 * Equipment Rental Catalog — /(buyer)/equipment
 *
 * Shows all rentable construction equipment types from the RENTAL_SERVICES
 * registry. Tapping a card navigates to the generic rental wizard
 * /(wizards)/rental?serviceType=MINI_EXCAVATOR (etc.)
 */
import React from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useHeaderConfig } from '@/lib/header-context';
import { RENTAL_SERVICES, type RentalServiceType } from '@/lib/rental-services';

// ── Equipment service types (exclude site support services) ──────────────────

const EQUIPMENT_TYPES: RentalServiceType[] = [
  'MINI_EXCAVATOR',
  'EXCAVATOR',
  'DUMPER',
  'COMPACTOR',
  'TELEHANDLER',
  'AERIAL_PLATFORM',
];

// ── Colour palette per type ──────────────────────────────────────────────────

const EQUIPMENT_COLORS: Record<RentalServiceType, { bg: string; accent: string }> = {
  MINI_EXCAVATOR: { bg: '#fef3c7', accent: '#d97706' },
  EXCAVATOR: { bg: '#fee2e2', accent: '#dc2626' },
  DUMPER: { bg: '#e0e7ff', accent: '#4f46e5' },
  COMPACTOR: { bg: '#f0fdf4', accent: '#16a34a' },
  TELEHANDLER: { bg: '#fce7f3', accent: '#be185d' },
  AERIAL_PLATFORM: { bg: '#e0f2fe', accent: '#0284c7' },
  // site support — not shown on this screen but needed for complete typing
  SCAFFOLDING: { bg: '#f3f4f6', accent: '#6b7280' },
  TEMP_FENCING: { bg: '#f3f4f6', accent: '#6b7280' },
  SITE_OFFICE: { bg: '#f3f4f6', accent: '#6b7280' },
  GENERATOR: { bg: '#f3f4f6', accent: '#6b7280' },
  LIGHTING_TOWER: { bg: '#f3f4f6', accent: '#6b7280' },
  WATER_BOWSER: { bg: '#f3f4f6', accent: '#6b7280' },
};

// ── Card ─────────────────────────────────────────────────────────────────────

function EquipmentCard({
  serviceType,
  onPress,
}: {
  serviceType: RentalServiceType;
  onPress: () => void;
}) {
  const service = RENTAL_SERVICES[serviceType];
  const colors = EQUIPMENT_COLORS[serviceType] ?? { bg: '#f3f4f6', accent: '#6b7280' };
  const Icon = service.Icon;

  return (
    <TouchableOpacity
      className="bg-white mx-5 mb-3 p-4 flex-row items-center rounded-2xl"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
      }}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      {/* Icon block */}
      <View
        className="h-14 w-14 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: colors.bg }}
      >
        <Icon size={24} color={colors.accent} strokeWidth={2} />
      </View>

      {/* Text */}
      <View className="flex-1 justify-center pr-2">
        <Text className="text-gray-900 font-bold tracking-tight" style={{ fontSize: 17 }}>
          {service.label}
        </Text>
        <Text className="text-gray-500 font-medium text-sm mt-0.5 line-clamp-1">
          {service.description}
        </Text>
      </View>

      {/* Arrow */}
      <ChevronRight size={18} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function EquipmentCatalogScreen() {
  const router = useRouter();
  const { setConfig } = useHeaderConfig();

  React.useEffect(() => {
    setConfig({ title: 'Tehnikas noma', backHref: '/(buyer)/home' });
  }, [setConfig]);

  return (
    <ScreenContainer>
      <ScreenHeader title="Tehnikas noma" showBack />

      <FlatList
        data={EQUIPMENT_TYPES}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text className="text-gray-500 text-sm px-5 mb-4">
            Nomas tehnika ar piegādi uz jūsu objektu. Cena — dienā.
          </Text>
        }
        renderItem={({ item }) => (
          <EquipmentCard
            serviceType={item}
            onPress={() => {
              router.push({
                pathname: '/(wizards)/rental',
                params: { serviceType: item },
              });
            }}
          />
        )}
      />
    </ScreenContainer>
  );
}
