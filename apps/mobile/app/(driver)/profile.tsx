import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
  X,
  LogOut,
  Trash2,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Settings,
  Bell,
  ArrowUpDown,
  Globe,
  Package,
  Truck,
  BarChart2,
  FileText,
  Handshake,
  Euro,
  Briefcase,
  FileCheck,
  Target,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useMode } from '@/lib/mode-context';
import { RoleSheet } from '@/components/ui/TopBar';
import { api, type ProviderApplication } from '@/lib/api';
import { t } from '@/lib/translations';
import { getRoleName } from '@/lib/utils';
// If this file runs in Seller mode, it can import quotes hook
import { useOpenQuoteCount } from '@/lib/use-open-quote-count';

export default function ProfileScreen() {
  const { user, token, updateUser, logout } = useAuth();
  const { mode, isMultiRole } = useMode();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const openQuoteCount = useOpenQuoteCount(); // Used safely even if we don't show it

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  });
  const toast = useToast();

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const [applications, setApplications] = useState<ProviderApplication[]>([]);
  useEffect(() => {
    if (!token) return;
    api.providerApplications
      .mine(token)
      .then(setApplications)
      .catch(() => {});
  }, [token]);

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
    haptics.light();
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

  // Check completeness
  const steps = [
    { done: !!(user?.firstName && user?.lastName), label: 'Vārds' },
    { done: !!user?.phone, label: 'Tālrunis' },
    { done: !!user?.email, label: 'E-pasts' },
  ];
  const missing = steps.filter((step) => !step.done);
  const isComplete = missing.length === 0;

  return (
    <ScreenContainer topInset={0} bg="#f9fafb" noAnimation>
      <ScreenHeader title="Profils" onBack={null} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Profile Identity Block */}
        <TouchableOpacity
          className="flex-row items-center px-5 py-5 bg-white mb-2"
          activeOpacity={0.8}
          onPress={openEdit}
        >
          <View
            className={`w-[72px] h-[72px] rounded-full items-center justify-center mr-4 ${ROLE_THEME[mode] ? ROLE_THEME[mode].split(' ')[0] : 'bg-gray-100'}`}
          >
            <Text
              className={`text-2xl font-bold ${ROLE_THEME[mode] ? ROLE_THEME[mode].split(' ')[1] : 'text-gray-700'}`}
            >
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[22px] font-bold text-gray-900 mb-1" numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <View className="flex-row items-center flex-wrap">
              {user?.phone ? (
                <Text className="text-gray-500 font-medium mr-3">{user.phone}</Text>
              ) : (
                <Text className="text-gray-400 font-medium mr-3">{user?.email}</Text>
              )}
              <View className="bg-gray-100 px-2 py-0.5 rounded flex-row items-center">
                <Text className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  {accountTypeLabel}
                </Text>
              </View>
            </View>
          </View>
          <ChevronRight size={20} color="#d1d5db" />
        </TouchableOpacity>

        {/* Completeness Nudge */}
        {!isComplete && (
          <TouchableOpacity
            className="mx-5 my-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex-row items-center shadow-sm"
            activeOpacity={0.8}
            onPress={openEdit}
          >
            <AlertCircle size={20} color="#b45309" className="mr-3" />
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-900 mb-0.5">
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
          <View className="mb-3 border-y border-gray-100 bg-white">
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
        )}

        {/* Dynamic Mode-Specific Links */}
        <View className="mb-3 border-y border-gray-100 bg-white">
          {mode === 'BUYER' && (
            <MenuItem
              icon={BarChart2}
              label="Analītika"
              onPress={() => router.push('/(buyer)/analytics' as any)}
              hideBorder
            />
          )}

          {mode === 'SUPPLIER' && (
            <>
              <MenuItem
                icon={Euro}
                label="Izpeļņa"
                onPress={() => router.push('/(seller)/earnings' as any)}
              />
              <MenuItem
                icon={FileText}
                label="Cenu pieprasījumi"
                value={openQuoteCount > 0 ? `${openQuoteCount} gaida` : undefined}
                onPress={() => router.push('/(seller)/quotes' as any)}
              />
              <MenuItem
                icon={FileCheck}
                label="Pavadzīmes"
                onPress={() => router.push('/(seller)/documents' as any)}
              />
              <MenuItem
                icon={Handshake}
                label="Ilgtermiņa līgumi"
                onPress={() => router.push('/(seller)/framework-contracts' as any)}
                hideBorder
              />
            </>
          )}

          {mode === 'CARRIER' && (
            <>
              <MenuItem
                icon={Euro}
                label="Izpeļņa"
                onPress={() => router.push('/(driver)/earnings' as any)}
              />
              <MenuItem
                icon={Truck}
                label="Transporti"
                onPress={() => router.push('/(driver)/vehicles' as any)}
              />
              <MenuItem
                icon={Package}
                label="Konteineri (Skips)"
                onPress={() => router.push('/(driver)/skips' as any)}
              />
              <MenuItem
                icon={FileCheck}
                label="Pavadzīmes"
                onPress={() => router.push('/(driver)/documents' as any)}
              />
              <MenuItem
                icon={Target}
                label="Pārvadātāja iestatījumi"
                onPress={() => router.push('/(driver)/carrier-settings' as any)}
                hideBorder
              />
            </>
          )}
        </View>

        {/* Application Section (Only show if missing rights and in BUYER mode commonly or generally) */}
        {(!user?.canSell || !user?.canTransport) && mode === 'BUYER' && (
          <View className="mb-3 border-y border-gray-100 bg-white">
            {!user?.canSell &&
              (() => {
                const app = applications.find((a) => a.appliesForSell);
                if (app?.status === 'PENDING') {
                  return (
                    <ApplicationRow
                      icon={Package}
                      label="Piegādātāja pieteikums"
                      status="PENDING"
                      hideBorder={!!user?.canTransport}
                    />
                  );
                }
                if (app?.status === 'REJECTED') {
                  return (
                    <ApplicationRow
                      icon={Package}
                      label="Piegādātāja pieteikums"
                      status="REJECTED"
                      onReapply={() => router.push('/(auth)/apply-role?type=supplier' as any)}
                      hideBorder={!!user?.canTransport}
                    />
                  );
                }
                return (
                  <MenuItem
                    icon={Package}
                    label="Kļūt par piegādātāju"
                    hideBorder={!!user?.canTransport}
                    onPress={() => router.push('/(auth)/apply-role?type=supplier' as any)}
                  />
                );
              })()}

            {!user?.canTransport &&
              (() => {
                const app = applications.find((a) => a.appliesForTransport);
                if (app?.status === 'PENDING') {
                  return (
                    <ApplicationRow
                      icon={Truck}
                      label="Pārvadātāja pieteikums"
                      status="PENDING"
                      hideBorder
                    />
                  );
                }
                if (app?.status === 'REJECTED') {
                  return (
                    <ApplicationRow
                      icon={Truck}
                      label="Pārvadātāja pieteikums"
                      status="REJECTED"
                      onReapply={() => router.push('/(auth)/apply-role?type=carrier' as any)}
                      hideBorder
                    />
                  );
                }
                return (
                  <MenuItem
                    icon={Truck}
                    label="Kļūt par pārvadātāju"
                    hideBorder
                    onPress={() => router.push('/(auth)/apply-role?type=carrier' as any)}
                  />
                );
              })()}
          </View>
        )}

        {/* General Settings */}
        <View className="mb-3 border-y border-gray-100 bg-white">
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

          {/* Language Toggle inline item */}
          <TouchableOpacity
            className="flex-row items-center px-5 py-4 bg-white"
            onPress={() => {
              haptics.light();
              setLanguage(language === 'lv' ? 'ru' : 'lv');
            }}
            activeOpacity={0.7}
          >
            <View className="w-9 h-9 rounded-full items-center justify-center mr-4 bg-gray-100">
              <Globe size={18} color="#4b5563" strokeWidth={2} />
            </View>
            <View className="flex-1 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900">Valoda / Язык</Text>
              <View className="flex-row items-center">
                <Text
                  className={`text-sm font-bold ${language === 'lv' ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  LV
                </Text>
                <Text className="text-sm font-bold text-gray-300 mx-1.5">|</Text>
                <Text
                  className={`text-sm font-bold ${language === 'ru' ? 'text-gray-900' : 'text-gray-400'}`}
                >
                  RU
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Destructive Actions */}
        <View className="mb-3 border-y border-gray-100 bg-white">
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

      {/* Edit modal */}
      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-white"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View className="flex-row items-center px-4 pt-4 pb-2">
            <TouchableOpacity
              onPress={() => setEditOpen(false)}
              hitSlop={10}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <X size={20} color="#111827" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-[32px] font-bold text-gray-900 mb-8 tracking-tight">
              Konta informācija
            </Text>

            <View className="gap-6">
              <View>
                <Text className="text-[13px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                  Vārds
                </Text>
                <TextInput
                  className="bg-gray-100 rounded-2xl px-5 py-4 text-[17px] text-gray-900 font-semibold"
                  value={form.firstName}
                  onChangeText={set('firstName')}
                  placeholder="Ievadiet vārdu"
                  placeholderTextColor="#9ca3af"
                  maxLength={80}
                />
              </View>
              <View>
                <Text className="text-[13px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                  Uzvārds
                </Text>
                <TextInput
                  className="bg-gray-100 rounded-2xl px-5 py-4 text-[17px] text-gray-900 font-semibold"
                  value={form.lastName}
                  onChangeText={set('lastName')}
                  placeholder="Ievadiet uzvārdu"
                  placeholderTextColor="#9ca3af"
                  maxLength={80}
                />
              </View>
              <View>
                <Text className="text-[13px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                  Tālrunis
                </Text>
                <TextInput
                  className="bg-gray-100 rounded-2xl px-5 py-4 text-[17px] text-gray-900 font-semibold"
                  value={form.phone}
                  onChangeText={set('phone')}
                  placeholder="+371 20000000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={20}
                />
              </View>
            </View>
          </ScrollView>

          {/* Sticky Footer */}
          <View className="px-5 py-4 border-t border-gray-100 bg-white mb-2 pb-10">
            <TouchableOpacity
              className={`bg-gray-900 py-4 rounded-full items-center justify-center flex-row shadow-sm ${saving ? 'opacity-70' : ''}`}
              onPress={saveEdit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-[17px] font-bold">Saglabāt</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {isMultiRole && <RoleSheet visible={roleSheetOpen} onClose={() => setRoleSheetOpen(false)} />}
    </ScreenContainer>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function MenuItem({ icon: Icon, label, value, onPress, isDestructive, hideBorder }: any) {
  return (
    <>
      <TouchableOpacity
        className="flex-row items-center px-5 py-3.5 bg-white"
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
      >
        <View
          className={`w-9 h-9 rounded-full items-center justify-center mr-4 ${isDestructive ? 'bg-red-50' : 'bg-gray-100'}`}
        >
          <Icon size={18} color={isDestructive ? '#ef4444' : '#4b5563'} strokeWidth={2} />
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <Text
            className={`text-base font-semibold ${isDestructive ? 'text-red-600' : 'text-gray-900'}`}
          >
            {label}
          </Text>
          <View className="flex-row items-center">
            {!!value && <Text className="text-sm font-medium text-gray-500 mr-2">{value}</Text>}
            {!isDestructive && onPress && <ChevronRight size={18} color="#d1d5db" />}
          </View>
        </View>
      </TouchableOpacity>
      {!hideBorder && <View className="h-px bg-gray-50 ml-[68px]" />}
    </>
  );
}

function ApplicationRow({ icon: Icon, label, status, onReapply, hideBorder }: any) {
  return (
    <>
      <View className="flex-row items-center px-5 py-3.5 bg-white">
        <View className="w-9 h-9 rounded-full items-center justify-center mr-4 bg-gray-100">
          <Icon size={18} color="#4b5563" strokeWidth={2} />
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-gray-900">{label}</Text>
          {status === 'PENDING' ? (
            <View className="bg-amber-100 px-2 py-1 rounded">
              <Text className="text-xs font-bold text-amber-800 tracking-wide uppercase">
                Izskatīšanā
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2.5">
              <View className="bg-red-100 px-2 py-1 rounded">
                <Text className="text-xs font-bold text-red-800 tracking-wide uppercase">
                  Noraidīts
                </Text>
              </View>
              {onReapply && (
                <TouchableOpacity onPress={onReapply} activeOpacity={0.7}>
                  <Text className="text-sm font-bold text-blue-600">Atkārtot</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      {!hideBorder && <View className="h-px bg-gray-50 ml-[68px]" />}
    </>
  );
}
