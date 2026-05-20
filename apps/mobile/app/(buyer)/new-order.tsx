import { useRouter } from 'expo-router';
import { HardHat, Trash2, Truck, FileText, ChevronRight } from 'lucide-react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { haptics } from '@/lib/haptics';

const ORDER_TYPES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiālu piegāde',
    sub: 'Grants, smiltis, betona materiāli',
    route: '/(wizards)/material-order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Atkritumus utilizēt',
    sub: 'Celtniecības atkritumi, zeme, lūžņi',
    route: '/disposal',
  },
  {
    id: 'transport',
    icon: Truck,
    label: 'Pārvadājumu pasūtījums',
    sub: 'Kravas transports uz jebkuru adresi',
    route: '/transport',
  },
  {
    id: 'framework',
    icon: FileText,
    label: 'Ietvara līgums',
    sub: 'Regulāri piegāžu grafiki projektiem',
    route: '/(buyer)/framework-contracts',
  },
] as const;

export default function NewOrderScreen() {
  const router = useRouter();
  return (
    <ScreenContainer>
      <ScreenHeader
        title="Jauns pasūtījums"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        }}
      />
      <View style={styles.list}>
        {ORDER_TYPES.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => {
                haptics.light();
                router.push(item.route as never);
              }}
            >
              <View style={styles.iconWrap}>
                <Icon size={24} color="#111827" />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.sub}>{item.sub}</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  sub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
});
