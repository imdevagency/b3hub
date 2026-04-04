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
import { useToast } from '@/components/ui/Toast';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import {
  Pencil,
  X,
  Check,
  LogOut,
  Trash2,
  ChevronRight,
  Phone,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Mail,
  Shield,
  Settings,
  Bell,
  Activity,
  ArrowUpDown,
  Building2,
  Globe,
  FolderKanban,
  FileText,
  FileCheck,
  Users,
  Handshake,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useMode } from '@/lib/mode-context';
import { RoleSheet } from '@/components/ui/TopBar';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import { ACCOUNT_STATUS } from '@/lib/materials';
import { getRoleName } from '@/lib/utils';

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  initials: { fontSize: 30, fontWeight: '700', color: '#111827' },
  name: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  headerEmail: { color: '#6b7280', marginTop: 4, marginBottom: 16, fontSize: 14 },
  headerEditBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEditBtnText: { fontWeight: '600', color: '#374151', fontSize: 14 },

  nudge: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeTitle: { fontWeight: '700', color: '#78350f', fontSize: 14 },
  nudgeSubtitle: { color: '#b45309', fontSize: 12, marginTop: 2 },

  menuConfig: { paddingHorizontal: 20 },
  sectionHeader: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuFooter: { marginTop: 32, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  roleSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  menuItemContent: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNormal: { backgroundColor: '#f3f4f6' },
  iconDestructive: { backgroundColor: '#fef2f2' },
  menuLabel: { fontWeight: '600', fontSize: 16, color: '#111827' },
  menuValue: { color: '#6b7280', fontSize: 14, marginTop: 2 },

  // Modal styles (unchanged)
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
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  saveBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  langCaps: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  langOpt: { fontSize: 13, fontWeight: '600', color: '#9ca3af', paddingHorizontal: 4 },
  langOptActive: { color: '#111827' },
  langSep: { fontSize: 12, color: '#d1d5db' },
});

export default function ProfileScreen() {
  const { user, token, updateUser, logout } = useAuth();
  const { mode, isMultiRole } = useMode();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const toast = useToast();

  const roleLabel = t.mode[mode];
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const ROLE_THEME: Record<string, { avatarBg: string; badgeBg: string; badgeText: string }> = {
    buyer: { avatarBg: '#fee2e2', badgeBg: '#fef2f2', badgeText: '#b91c1c' },
    seller: { avatarBg: '#d1fae5', badgeBg: '#f0fdf4', badgeText: '#15803d' },
    driver: { avatarBg: '#dbeafe', badgeBg: '#eff6ff', badgeText: '#1d4ed8' },
  };
  const roleTheme = ROLE_THEME[mode] ?? ROLE_THEME.buyer;

  const accountTypeLabel = user?.userType === 'ADMIN' ? 'Administrators' : getRoleName(user);
  const { language, setLanguage } = useLanguage();

  const handleLogout = () => {
    Alert.alert('Iziet', 'Vai tiešām vēlaties izrakstīties?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Iziet',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Dzēst kontu',
      'Vai tiešām vēlaties neatgriezeniski dzēst savu kontu? Visi jūsu personas dati tiks dzēsti. Šo darbību nevar atsaukt.',
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Dzēst kontu',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await api.deleteAccount(token);
              await logout();
            } catch {
              haptics.error();
              toast.error('Neizdevās dzēst kontu. Lūdzu, mēģiniet vēlreiz.');
            }
          },
        },
      ],
    );
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
      toast.error('Neizdevās saglabāt izmaiņas. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <ScreenContainer bg="white">
      <ScreenHeader title="Profils" onBack={null} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Minimal Avatar Header */}
        <View style={s.header}>
          <View style={[s.avatar, { backgroundColor: roleTheme.avatarBg }]}>
            <Text style={s.initials}>{initials}</Text>
          </View>
          <Text style={s.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={s.headerEmail}>{user?.email}</Text>

          <TouchableOpacity onPress={openEdit} style={s.headerEditBtn} activeOpacity={0.8}>
            <Pencil size={14} color="#374151" />
            <Text style={s.headerEditBtnText}>Rediģēt profilu</Text>
          </TouchableOpacity>
        </View>

        {/* Role Switcher */}
        {isMultiRole && (
          <TouchableOpacity
            style={s.roleSwitchRow}
            onPress={() => {
              haptics.light();
              setRoleSheetOpen(true);
            }}
            activeOpacity={0.75}
          >
            <View style={[s.menuIcon, s.iconNormal]}>
              <ArrowUpDown size={18} color="#374151" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>Mainīt lomu</Text>
              <Text style={s.menuValue}>{t.mode[mode]}</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Missing Phone Nudge */}
        {!user?.phone && (
          <TouchableOpacity style={s.nudge} onPress={openEdit} activeOpacity={0.8}>
            <View style={s.nudgeIcon}>
              <AlertCircle size={20} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nudgeTitle}>Pievienot tālruni</Text>
              <Text style={s.nudgeSubtitle}>Nepieciešams saziņai</Text>
            </View>
            <ChevronRight size={16} color="#d97706" />
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View style={s.menuConfig}>
          <Text style={s.sectionHeader}>Darba rīki</Text>

          <MenuItem
            icon={FolderKanban}
            label="Projekti"
            onPress={() => router.push('/(buyer)/projects' as any)}
          />
          <MenuItem
            icon={FileText}
            label="Rēķini"
            onPress={() => router.push('/(buyer)/invoices' as any)}
          />
          <MenuItem
            icon={FileCheck}
            label="Dokumenti"
            onPress={() => router.push('/(buyer)/certificates' as any)}
          />
          <MenuItem
            icon={Users}
            label="Komanda"
            onPress={() => router.push('/(buyer)/team' as any)}
          />
          <MenuItem
            icon={Handshake}
            label="Ietvarlīgumi"
            onPress={() => router.push('/(buyer)/framework-contracts' as any)}
          />

          <Text style={[s.sectionHeader, { marginTop: 32 }]}>Konta informācija</Text>

          <MenuItem
            icon={Phone}
            label="Tālrunis"
            value={user?.phone || 'Nav norādīts'}
            onPress={openEdit}
          />
          {user?.company && (
            <MenuItem icon={Building2} label="Uzņēmums" value={user.company.name} />
          )}
          <MenuItem icon={Shield} label="Konta veids" value={accountTypeLabel} />
          <MenuItem
            icon={Activity}
            label="Statuss"
            value={ACCOUNT_STATUS[user?.status ?? ''] ?? user?.status}
          />

          <Text style={[s.sectionHeader, { marginTop: 32 }]}>Atbalsts</Text>

          <MenuItem
            icon={Bell}
            label="Paziņojumi"
            value={
              [user?.notifOrderUpdates, user?.notifJobAlerts, user?.notifPush].filter(Boolean)
                .length === 0
                ? 'Izslēgti'
                : user?.notifPush === false
                  ? 'Tikai lietotnē'
                  : 'Ieslēgti'
            }
            onPress={() => router.push('/notifications' as any)}
          />
          <MenuItem
            icon={MessageCircle}
            label="Ziņojumi"
            onPress={() => router.push('/messages' as any)}
          />
          <MenuItem
            icon={Settings}
            label="Iestatījumi"
            onPress={() => router.push('/settings' as any)}
          />
          <MenuItem
            icon={HelpCircle}
            label="Palīdzība / BUJ"
            onPress={() => router.push('/help' as any)}
          />
          <TouchableOpacity
            style={s.langRow}
            onPress={() => {
              haptics.light();
              setLanguage(language === 'lv' ? 'ru' : 'lv');
            }}
            activeOpacity={0.7}
          >
            <View style={s.menuItemContent}>
              <View style={s.menuIcon}>
                <Globe size={20} color="#4b5563" />
              </View>
              <Text style={s.menuLabel}>Valoda / Язык</Text>
            </View>
            <View style={s.langCaps}>
              <Text style={[s.langOpt, language === 'lv' && s.langOptActive]}>LV</Text>
              <Text style={s.langSep}> | </Text>
              <Text style={[s.langOpt, language === 'ru' && s.langOptActive]}>RU</Text>
            </View>
          </TouchableOpacity>

          <View style={s.menuFooter}>
            <MenuItem icon={LogOut} label="Iziet" onPress={handleLogout} isDestructive />
            <MenuItem
              icon={Trash2}
              label="Dzēst kontu"
              onPress={handleDeleteAccount}
              isDestructive
            />
          </View>
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
          style={{ flex: 1, backgroundColor: '#f9fafb' }}
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
                maxLength={80}
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
                maxLength={80}
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
                maxLength={20}
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
      {isMultiRole && <RoleSheet visible={roleSheetOpen} onClose={() => setRoleSheetOpen(false)} />}
    </ScreenContainer>
  );
}

const MenuItem = ({
  icon: Icon,
  label,
  value,
  onPress,
  isDestructive,
  rightIcon: RightIcon = ChevronRight,
}: any) => (
  <TouchableOpacity style={s.menuItem} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
    <View style={s.menuItemContent}>
      <View style={[s.menuIcon, isDestructive ? s.iconDestructive : s.iconNormal]}>
        <Icon size={20} color={isDestructive ? '#ef4444' : '#4b5563'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuLabel, isDestructive && { color: '#ef4444' }]}>{label}</Text>
        {!!value && (
          <Text style={s.menuValue} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
    </View>
    {onPress && !isDestructive && <RightIcon size={18} color="#e5e7eb" />}
  </TouchableOpacity>
);
