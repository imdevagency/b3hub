import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
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


function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

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
      .catch((err) => console.warn('Failed to load applications:', err));
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
    <ScreenContainer topInset={0} bg="#f6f8fb" noAnimation>
      <ScreenHeader title="Profils" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Identity Block */}
        <TouchableOpacity
          style={[styles.profileCard, { marginTop: 16 }]}
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
            <Text
              className=" font-bold text-gray-900 mb-1"
              style={{ fontSize: 22 }}
              numberOfLines={1}
            >
              {user?.firstName} {user?.lastName}
            </Text>
            <View className="flex-row items-center flex-wrap">
              {user?.phone ? (
                <Text className="text-gray-500 font-medium mr-3">{user.phone}</Text>
              ) : (
                <Text className="text-gray-400 font-medium mr-3">{user?.email}</Text>
              )}
              <View className="bg-gray-100 px-2 py-0.5 rounded flex-row items-center">
                <Text
                  className="font-bold text-gray-600 uppercase tracking-widest"
                  style={{ fontSize: 10 }}
                >
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
            style={[styles.nudgeCard, { marginTop: 12 }]}
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
          <><SectionHeader label="LOMA" />
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
          </View></>
        )}

        {/* Dynamic Mode-Specific Links */}
        <SectionHeader label="DARBĪBAS" />
        <View style={styles.cardGroup}>
          {mode === 'BUYER' && (
            <MenuItem
              icon={BarChart2}
              label="Analītika"
              onPress={() => router.push('/(buyer)/analytics')}
              hideBorder
            />
          )}

          {mode === 'SUPPLIER' && (
            <>
              <MenuItem
                icon={Euro}
                label="Izpeļņa"
                onPress={() => router.push('/(seller)/earnings')}
              />
              <MenuItem
                icon={FileText}
                label="Cenu pieprasījumi"
                value={openQuoteCount > 0 ? `${openQuoteCount} gaida` : undefined}
                onPress={() => router.push('/(seller)/quotes')}
              />
              <MenuItem
                icon={FileCheck}
                label="Pavadzīmes"
                onPress={() => router.push('/(seller)/documents')}
              />
              <MenuItem
                icon={Handshake}
                label="Ilgtermiņa līgumi"
                onPress={() => router.push('/(seller)/framework-contracts')}
                hideBorder
              />
            </>
          )}

          {mode === 'CARRIER' && (
            <>
              <MenuItem
                icon={Euro}
                label="Izpeļņa"
                onPress={() => router.push('/(driver)/earnings')}
              />
              <MenuItem
                icon={Truck}
                label="Transporti"
                onPress={() => router.push('/(driver)/vehicles')}
              />
              <MenuItem
                icon={Package}
                label="Konteineri (Skips)"
                onPress={() => router.push('/(driver)/skips')}
              />
              <MenuItem
                icon={FileCheck}
                label="Pavadzīmes"
                onPress={() => router.push('/(driver)/documents')}
              />
              <MenuItem
                icon={Target}
                label="Pārvadātāja iestatījumi"
                onPress={() => router.push('/(driver)/carrier-settings')}
                hideBorder
              />
            </>
          )}
        </View>

        {/* Application Section (Only show if missing rights and in BUYER mode commonly or generally) */}
        {(!user?.canSell || !user?.canTransport) && mode === 'BUYER' && (
          <><SectionHeader label="PIETEIKUMI" />
          <View style={styles.cardGroup}>
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
                      onReapply={() => router.push('/(auth)/apply-role?type=supplier')}
                      hideBorder={!!user?.canTransport}
                    />
                  );
                }
                return (
                  <MenuItem
                    icon={Package}
                    label="Kļūt par piegādātāju"
                    hideBorder={!!user?.canTransport}
                    onPress={() => router.push('/(auth)/apply-role?type=supplier')}
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
                      onReapply={() => router.push('/(auth)/apply-role?type=carrier')}
                      hideBorder
                    />
                  );
                }
                return (
                  <MenuItem
                    icon={Truck}
                    label="Kļūt par pārvadātāju"
                    hideBorder
                    onPress={() => router.push('/(auth)/apply-role?type=carrier')}
                  />
                );
              })()}
          </View></>
        )}

        {/* General Settings */}
        <SectionHeader label="VISPĀRĪGI" />
        <View style={styles.cardGroup}>
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
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            icon={MessageCircle}
            label="Ziņojumi"
            onPress={() => router.push('/messages')}
          />
          <MenuItem icon={Settings} label="Iestatījumi" onPress={() => router.push('/settings')} />
          <MenuItem
            icon={HelpCircle}
            label="Palīdzība / BUJ"
            onPress={() => router.push('/help')}
          />

          {/* Language Toggle inline item */}
          <TouchableOpacity
            style={styles.cardItem}
            onPress={() => {
              haptics.light();
              setLanguage(language === 'lv' ? 'ru' : 'lv');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
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
            <Text className=" font-bold text-gray-900 mb-8 tracking-tight" style={{ fontSize: 32 }}>
              Konta informācija
            </Text>

            <View className="gap-6">
              <View>
                <Text
                  className=" font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
                  className=" font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
                  className=" font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
                <Text className="text-white font-bold" style={{ fontSize: 17 }}>
                  Saglabāt
                </Text>
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
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Icon size={20} color={isDestructive ? '#ef4444' : '#6b7280'} strokeWidth={2} />
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

function ApplicationRow({
  icon: Icon,
  label,
  status,
  onReapply,
  hideBorder,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  status: string;
  onReapply?: () => void;
  hideBorder?: boolean;
}) {
  return (
    <View style={styles.cardItem}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Icon size={20} color="#6b7280" strokeWidth={2} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        
        {status === 'PENDING' ? (
          <View style={styles.badgeAmber}>
            <Text style={styles.badgeAmberText}>Izskatīšanā</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.badgeRed}>
              <Text style={styles.badgeRedText}>Noraidīts</Text>
            </View>
            {onReapply && (
              <TouchableOpacity onPress={onReapply} activeOpacity={0.7}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3b82f6' }}>Atkārtot</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 60,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  nudgeCard: {
    backgroundColor: '#fffbeb', // amber-50
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#fef3c7', // amber-100
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#6b7280',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  cardGroup: {
    gap: 8,
    paddingHorizontal: 16,
  },
  cardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  rowDescValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginRight: 8,
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
  badgeAmber: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAmberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
  },
  badgeRed: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
    textTransform: 'uppercase',
  },
});
