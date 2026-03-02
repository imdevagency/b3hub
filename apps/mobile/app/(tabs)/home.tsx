import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { t } from '@/lib/translations';

type QuickAction = { emoji: string; label: string; route?: string };

const ROLE_ACTIONS: Record<string, QuickAction[]> = {
  BUYER: [
    { emoji: '🏗️', label: 'Pirkt materiālus' },
    { emoji: '🗑️', label: 'Nomāt konteineru', route: '/order' },
    { emoji: '🚛', label: 'Izsekot piegādi' },
    { emoji: '🧾', label: 'Rēķini' },
  ],
  SUPPLIER: [
    { emoji: '📦', label: 'Mani produkti' },
    { emoji: '📋', label: 'Saņemtie pasūtījumi' },
    { emoji: '➕', label: 'Pievienot preci' },
    { emoji: '📊', label: 'Statistika' },
  ],
  CARRIER: [
    { emoji: '📍', label: 'Aktīvie darbi' },
    { emoji: '🗺️', label: 'Maršruts' },
    { emoji: '✅', label: 'Pabeigt piegādi' },
    { emoji: '💰', label: 'Ieņēmumi' },
  ],
  PRIVATE: [
    { emoji: '🗑️', label: 'Pasūtīt konteineru', route: '/order' },
    { emoji: '📋', label: 'Mani pasūtījumi' },
    { emoji: '🚛', label: 'Izsekot piegādi' },
    { emoji: '🆘', label: 'Atbalsts' },
  ],
};

const USER_TYPE_LABEL: Record<string, string> = {
  BUYER: 'Darbuzņēmējs',
  SUPPLIER: 'Pārdevējs',
  CARRIER: 'Pārvadātājs',
  PRIVATE: 'Privātpersona',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const role = user?.userType ?? 'PRIVATE';
  const actions = ROLE_ACTIONS[role] ?? ROLE_ACTIONS.PRIVATE;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerGreeting}>{t.home.greeting}</Text>
          <Text style={s.headerName}>
            {user?.firstName} {user?.lastName} 👋
          </Text>
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>{USER_TYPE_LABEL[role] ?? role}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Stats card */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t.home.overview}</Text>
            <View style={s.statsRow}>
              {[
                { label: t.home.stats.materials, value: '—' },
                { label: t.home.stats.orders, value: '—' },
                { label: t.home.stats.pending, value: '—' },
              ].map((stat) => (
                <View key={stat.label} style={s.statItem}>
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quick actions */}
          <Text style={s.quickTitle}>{t.home.quickActions}</Text>
          <View style={s.actionGrid}>
            {actions.map((action, idx) => {
              // BUYER gets two primary cards (materials + skip hire)
              const isPrimary = role === 'BUYER' ? idx < 2 : idx === 0;
              return (
                <TouchableOpacity
                  key={action.label}
                  style={[s.actionBtn, isPrimary ? s.actionBtnPrimary : null]}
                  activeOpacity={0.7}
                  onPress={() => action.route && router.push(action.route as any)}
                >
                  <Text style={s.actionEmoji}>{action.emoji}</Text>
                  <Text style={[s.actionLabel, isPrimary ? s.actionLabelPrimary : null]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerGreeting: { color: '#fca5a5', fontSize: 14 },
  headerName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  typeBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  body: { paddingHorizontal: 20, marginTop: -20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  quickTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  actionBtnPrimary: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  actionEmoji: { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '500', color: '#374151' },
  actionLabelPrimary: { color: '#fff', fontWeight: '600' },
});
