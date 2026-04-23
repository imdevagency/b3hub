import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TopBar } from '@/components/ui/TopBar';
import { useRouter } from 'expo-router';
import { FileText, AlertCircle, MapPin, ChevronRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

interface BizTool {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
  route: string;
}

const FINANCES: BizTool[] = [
  {
    icon: FileText,
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    label: 'Rēķini & Dokumenti',
    description: 'Rēķini, piegādes dokumenti',
    route: '/(buyer)/documents',
  },
  {
    icon: AlertCircle,
    iconBg: '#fef2f2',
    iconColor: '#dc2626',
    label: 'Strīdi',
    description: 'Atklâtās pretenzijas',
    route: '/(buyer)/disputes',
  },
  {
    icon: MapPin,
    iconBg: '#f9fafb',
    iconColor: '#374151',
    label: 'Saglabātās adreses',
    description: 'Biežāk izmantotās piegādes adreses',
    route: '/(buyer)/saved-addresses',
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
        router.push(tool.route);
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

export default function BusinessScreen() {
  return (
    <ScreenContainer bg="white">
      <TopBar title="Darbu centrs" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.container}>
        <Text style={s.sectionHeader}>Dokumenti & PārvaldĪba</Text>
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
    color: colors.textPrimary,
    marginBottom: 28,
    letterSpacing: -0.5,
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDisabled,
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
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  rowDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
});
