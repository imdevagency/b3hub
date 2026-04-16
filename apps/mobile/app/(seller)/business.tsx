import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TopBar } from '@/components/ui/TopBar';
import { useRouter } from 'expo-router';
import { LayoutGrid, Wallet, FileText, Handshake, ChevronRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

interface BizTool {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
  route: string;
}

const OPERATIONS: BizTool[] = [
  {
    icon: LayoutGrid,
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    label: 'Mans katalogs',
    description: 'Pārvaldīt materiālu piedāvājumus',
    route: '/(seller)/catalog',
  },
  {
    icon: Handshake,
    iconBg: '#f0fdf4',
    iconColor: '#16a34a',
    label: 'Ietvarlīgumi',
    description: 'Rāmja līgumi ar pircējiem',
    route: '/(seller)/framework-contracts',
  },
];

const FINANCES: BizTool[] = [
  {
    icon: Wallet,
    iconBg: '#faf5ff',
    iconColor: '#9333ea',
    label: 'Ienākumi',
    description: 'Ieņēmumi, izmaksas, statistika',
    route: '/(seller)/earnings',
  },
  {
    icon: FileText,
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    label: 'Dokumenti',
    description: 'Rēķini un piegādes dokumenti',
    route: '/(seller)/documents',
  },
];

function BizRow({ tool }: { tool: BizTool }) {
  const router = useRouter();
  const Icon = tool.icon;
  return (
    <TouchableOpacity
      style={s.row}
      activeOpacity={0.7}
      onPress={() => {
        haptics.light();
        router.push(tool.route as any);
      }}
    >
      <View style={[s.iconWrap, { backgroundColor: tool.iconBg }]}>
        <Icon size={22} color={tool.iconColor} strokeWidth={2} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{tool.label}</Text>
        <Text style={s.rowDesc}>{tool.description}</Text>
      </View>
      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

export default function SellerBusinessScreen() {
  return (
    <ScreenContainer bg="white">
      <TopBar title="Pārdevēja centrs" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.container}>
        <Text style={s.sectionHeader}>Operācijas</Text>
        {OPERATIONS.map((tool) => (
          <BizRow key={tool.route} tool={tool} />
        ))}

        <Text style={[s.sectionHeader, { marginTop: 28 }]}>Finanses & Dokumenti</Text>
        {FINANCES.map((tool) => (
          <BizRow key={tool.route} tool={tool} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 28,
    letterSpacing: -0.5,
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
  },
  rowDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
});
