import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { Pencil, X, Check, LogOut, Bell, ChevronRight, Settings, MessageCircle, HelpCircle } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';

export default function ProfileScreen() {
  const { user, token, updateUser, logout } = useAuth();
  const { mode } = useMode();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });

  const roleLabel = t.mode[mode];
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const handleLogout = () => {
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const openEdit = () => {
    setForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!token || !user) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile(
        {
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
        token,
      );
      await updateUser(updated);
      haptics.success();
      setEditOpen(false);
    } catch {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās saglabāt izmaiņas. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  };

  const INFO_ROWS = [
    { label: t.profile.email, value: user?.email },
    { label: t.profile.phone, value: user?.phone || '—' },
    {
      label: t.profile.accountType,
      value:
        (
          {
            BUYER: 'Pircējs',
            SUPPLIER: 'Piegādātājs',
            CARRIER: 'Pārvadātājs',
            ADMIN: 'Administrators',
          } as Record<string, string>
        )[user?.userType ?? ''] ?? user?.userType,
    },
    {
      label: t.profile.status,
      value:
        (
          {
            ACTIVE: 'Aktīvs',
            PENDING: 'Gaida apstiprināšanu',
            SUSPENDED: 'Apturēts',
            INACTIVE: 'Neaktīvs',
          } as Record<string, string>
        )[user?.status ?? ''] ?? user?.status,
    },
  ];

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <ScreenContainer bg="#f2f2f7">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar header */}
        <View style={s.avatarSection}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.fullName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleBadgeText}>{roleLabel}</Text>
          </View>
          <TouchableOpacity style={s.editBtn} onPress={openEdit} activeOpacity={0.8}>
            <Pencil size={13} color="#111827" />
            <Text style={s.editBtnText}>Rediģēt profilu</Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          {/* Info card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t.profile.account}</Text>
            {INFO_ROWS.map((item, idx) => (
              <View
                key={item.label}
                style={[s.row, idx < INFO_ROWS.length - 1 ? s.rowBorder : null]}
              >
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Quick links */}
          <TouchableOpacity
            style={s.linkRow}
            onPress={() => router.push('/messages' as any)}
            activeOpacity={0.8}
          >
            <View style={s.linkLeft}>
              <MessageCircle size={16} color="#374151" />
              <Text style={s.linkText}>Ziņojumi</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.linkRow}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.8}
          >
            <View style={s.linkLeft}>
              <Bell size={16} color="#374151" />
              <Text style={s.linkText}>Paziņojumi</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.linkRow}
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.8}
          >
            <View style={s.linkLeft}>
              <Settings size={16} color="#374151" />
              <Text style={s.linkText}>Iestatījumi</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.linkRow}
            onPress={() => router.push('/help' as any)}
            activeOpacity={0.8}
          >
            <View style={s.linkLeft}>
              <HelpCircle size={16} color="#374151" />
              <Text style={s.linkText}>Palīdzība / BUJ</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={16} color="#111827" />
            <Text style={s.signOutText}>{t.profile.signOut}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit modal */}
      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalHandle}>
            <View style={s.handleBar} />
          </View>
          <View style={s.modalToolbar}>
            <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={10}>
              <X size={20} color="#111827" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Rediģēt profilu</Text>
            <TouchableOpacity onPress={saveEdit} hitSlop={10} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Check size={20} color="#111827" />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Vārds</Text>
              <TextInput
                style={s.fieldInput}
                value={form.firstName}
                onChangeText={set('firstName')}
                placeholder="Vārds"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Uzvārds</Text>
              <TextInput
                style={s.fieldInput}
                value={form.lastName}
                onChangeText={set('lastName')}
                placeholder="Uzvārds"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Tālrunis</Text>
              <TextInput
                style={s.fieldInput}
                value={form.phone}
                onChangeText={set('phone')}
                placeholder="+371 20000000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.5 }]}
              onPress={saveEdit}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>Saglabāt</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },
  avatarSection: {
    backgroundColor: '#fff',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#111827', fontSize: 26, fontWeight: '700' },
  fullName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  email: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  roleBadge: {
    marginTop: 8,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: { color: '#b91c1c', fontSize: 12, fontWeight: '500' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fef2f2',
  },
  editBtnText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  body: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  rowLabel: { fontSize: 14, color: '#6b7280' },
  rowValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    paddingVertical: 16,
  },
  signOutText: { color: '#111827', fontWeight: '600', fontSize: 15 },
  // Modal
  modalHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  saveBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
