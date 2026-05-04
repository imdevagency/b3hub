import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useToast } from '@/components/ui/Toast';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { LogOut, Trash2, ChevronRight, AlertCircle, ArrowUpDown, Globe } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useMode } from '@/lib/mode-context';
import { RoleSheet } from '@/components/ui/TopBar';
import { useAvatarUpload } from '@/lib/use-avatar-upload';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import { getRoleName } from '@/lib/utils';

function SectionHeader({ label }: { label: string }) {
  return (
    <>
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionHeader}>{label}</Text>
    </>
  );
}

export default function ProfileScreen() {
  const { user, token, updateUser, logout } = useAuth();
  const { mode, isMultiRole } = useMode();
  const [editOpen, setEditOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar ?? null);

  const { pick: pickAvatar, uploading: avatarUploading } = useAvatarUpload({
    type: 'user',
    onSuccess: (url) => {
      setAvatarUrl(url);
      if (user) updateUser({ ...user, avatar: url });
    },
  });

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const toast = useToast();

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const ROLE_THEME: Record<string, string> = {
    BUYER: 'bg-red-50 text-red-700',
    SUPPLIER: 'bg-emerald-50 text-emerald-700',
    CARRIER: 'bg-blue-50 text-blue-700',
  };

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
    if (!user) return;
    haptics.light();
    setForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
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

  // Check completeness
  const steps = [
    { done: !!(user?.firstName && user?.lastName), label: 'Vārds' },
    { done: !!user?.phone, label: 'Tālrunis' },
    { done: !!user?.email, label: 'E-pasts' },
  ];
  const missing = steps.filter((step) => !step.done);
  const isComplete = missing.length === 0;

  return (
    <ScreenContainer topInset={0} bg="#ffffff" noAnimation>
      <ScreenHeader title="Profils" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Block — avatar tap = upload photo, text tap = edit name/phone */}
        <View style={styles.profileBlock}>
          <AvatarImage
            url={avatarUrl}
            initials={initials.toUpperCase()}
            size={64}
            onPress={pickAvatar}
            loading={avatarUploading}
          />
          <TouchableOpacity
            style={{ flex: 1, marginLeft: 16 }}
            activeOpacity={0.85}
            onPress={openEdit}
          >
            <Text
              style={{
                fontSize: 22,
                fontFamily: 'Inter_600SemiBold',
                fontWeight: '600',
                color: '#111827',
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {user?.firstName} {user?.lastName}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 4,
              }}
            >
              {user?.phone ? (
                <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6b7280' }}>
                  {user.phone}
                </Text>
              ) : (
                <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: '#9ca3af' }}>
                  {user?.email}
                </Text>
              )}
              <View
                style={{
                  backgroundColor: '#f3f4f6',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {accountTypeLabel}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9ca3af' }}>
              Pieskarties, lai rediģētu
            </Text>
          </TouchableOpacity>
          <ChevronRight size={20} color="#d1d5db" />
        </View>

        {/* Completeness Nudge */}
        {!!user && !isComplete && (
          <TouchableOpacity
            style={[styles.nudgeCard, { marginTop: 12 }]}
            activeOpacity={0.8}
            onPress={openEdit}
          >
            <AlertCircle size={20} color="#b45309" className="mr-3" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-900 mb-0.5">
                Pabeidziet konta reģistrāciju
              </Text>
              <Text className="text-xs font-medium text-amber-700">
                Trūkst informācijas: {missing.map((m) => m.label).join(', ')}
              </Text>
            </View>
            <ChevronRight size={16} color="#b45309" />
          </TouchableOpacity>
        )}

        {/* Role Switcher */}
        {isMultiRole && (
          <>
            <SectionHeader label="LOMA" />
            <View style={styles.cardGroup}>
              <MenuItem
                icon={ArrowUpDown}
                label="Mainīt lomu"
                value={t.mode[mode]}
                hideBorder
                onPress={() => {
                  haptics.light();
                  setRoleSheetOpen(true);
                }}
              />
            </View>
          </>
        )}

        {/* Language Toggle */}
        <SectionHeader label="VALODA" />
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.cardItem}
            onPress={() => {
              haptics.light();
              setLanguage(language === 'lv' ? 'ru' : 'lv');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.row]}>
              <View style={styles.rowIcon}>
                <Globe size={20} color="#6b7280" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Valoda / Язык</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.langOpt, language === 'lv' && styles.langOptActive]}>LV</Text>
                <Text style={{ color: '#d1d5db' }}>|</Text>
                <Text style={[styles.langOpt, language === 'ru' && styles.langOptActive]}>RU</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Destructive Actions */}
        <SectionHeader label="KONTA DARBĪBAS" />
        <View style={styles.cardGroup}>
          <MenuItem icon={LogOut} label="Iziet" onPress={handleLogout} />
          <MenuItem
            icon={Trash2}
            label="Dzēst kontu"
            onPress={handleDeleteAccount}
            isDestructive
            hideBorder
          />
        </View>
      </ScrollView>

      {/* Edit bottom sheet */}
      <BottomSheet
        visible={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title="Konta informācija"
        scrollable
        maxHeightPct={0.95}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 24 }}>
            <View>
              <Text
                className="font-semibold text-gray-500 uppercase tracking-widest mb-2 ml-1"
                style={{ fontSize: 13 }}
              >
                Vārds
              </Text>
              <TextInput
                className="bg-gray-100 rounded-2xl px-5 py-4 text-gray-900 font-semibold"
                style={{ fontSize: 17 }}
                value={form.firstName}
                onChangeText={set('firstName')}
                placeholder="Ievadiet vārdu"
                placeholderTextColor="#9ca3af"
                maxLength={80}
              />
            </View>
            <View>
              <Text
                className="font-semibold text-gray-500 uppercase tracking-widest mb-2 ml-1"
                style={{ fontSize: 13 }}
              >
                Uzvārds
              </Text>
              <TextInput
                className="bg-gray-100 rounded-2xl px-5 py-4 text-gray-900 font-semibold"
                style={{ fontSize: 17 }}
                value={form.lastName}
                onChangeText={set('lastName')}
                placeholder="Ievadiet uzvārdu"
                placeholderTextColor="#9ca3af"
                maxLength={80}
              />
            </View>
            <View>
              <Text
                className="font-semibold text-gray-500 uppercase tracking-widest mb-2 ml-1"
                style={{ fontSize: 13 }}
              >
                Tālrunis
              </Text>
              <TextInput
                className="bg-gray-100 rounded-2xl px-5 py-4 text-gray-900 font-semibold"
                style={{ fontSize: 17 }}
                value={form.phone}
                onChangeText={set('phone')}
                placeholder="+371 20000000"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>
          </View>
          <View className="px-5 py-4 border-t border-gray-100 bg-white">
            <TouchableOpacity
              className={`bg-[#166534] py-4 rounded-full items-center justify-center flex-row ${saving ? 'opacity-70' : ''}`}
              onPress={saveEdit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold" style={{ fontSize: 17 }}>
                  Saglabāt
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {isMultiRole && <RoleSheet visible={roleSheetOpen} onClose={() => setRoleSheetOpen(false)} />}
    </ScreenContainer>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function MenuItem({
  icon: Icon,
  label,
  value,
  onPress,
  isDestructive,
  hideBorder,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  hideBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.row, !hideBorder && styles.rowBorder]}>
        <View style={styles.rowIcon}>
          <Icon size={24} color={isDestructive ? '#ef4444' : '#6b7280'} strokeWidth={1.5} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowLabel, isDestructive && styles.dangerLabel]}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!!value && <Text style={styles.rowDescValue}>{value}</Text>}
          {!isDestructive && onPress && <ChevronRight size={20} color="#6b7280" />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 80,
  },
  profileBlock: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nudgeCard: {
    backgroundColor: '#fffbeb',
    marginHorizontal: 20,
    marginTop: 4,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F4F5F7',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  cardGroup: {
    backgroundColor: '#ffffff',
  },
  cardItem: {
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 17,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rowDescValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
    marginRight: 6,
  },
  dangerLabel: {
    color: '#ef4444',
  },
  langOpt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  langOptActive: {
    color: '#111827',
  },
});
