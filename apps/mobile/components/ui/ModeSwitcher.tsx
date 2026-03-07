import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Store, Truck } from 'lucide-react-native';
import { useMode, AppMode, MODE_HOME } from '@/lib/mode-context';
import { t } from '@/lib/translations';

const MODE_LABELS: Record<AppMode, string> = {
  buyer: t.mode.buyer,
  seller: t.mode.seller,
  driver: t.mode.driver,
};

function ModeSwitcherIcon({ mode, active }: { mode: AppMode; active: boolean }) {
  const color = active ? '#ffffff' : '#374151';
  const size = 14;
  if (mode === 'buyer') return <ShoppingCart size={size} color={color} />;
  if (mode === 'seller') return <Store size={size} color={color} />;
  return <Truck size={size} color={color} />;
}

export function ModeSwitcher() {
  const { mode, setMode, availableModes } = useMode();
  const router = useRouter();

  function handleSwitch(m: AppMode) {
    if (m === mode) return;
    setMode(m);
    router.replace(MODE_HOME[m] as any);
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {availableModes.map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => handleSwitch(m)}
            style={[styles.pill, mode === m && styles.pillActive]}
          >
            <ModeSwitcherIcon mode={m} active={mode === m} />
            <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>
              {MODE_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  pillTextActive: {
    color: '#ffffff',
  },
});
