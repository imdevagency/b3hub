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
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useToast } from '@/components/ui/Toast';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
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
  FileText,
  Handshake,
  Euro,
  FileCheck,
  Receipt,
  MapPin,
  Ticket,
  Calendar,
  ShieldCheck,
  Building2,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useMode } from '@/lib/mode-context';
import { RoleSheet } from '@/components/ui/TopBar';
import { api, type ProviderApplication, type AnalyticsOverview } from '@/lib/api';
import { t } from '@/lib/translations';
import { getRoleName } from '@/lib/utils';
// If this file runs in Seller mode, it can import quotes hook
import { useOpenQuoteCount } from '@/lib/use-open-quote-count';

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

  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  useEffect(() => {
    if (!token || !user?.isCompany) return;
    api.analytics
      .overview(token)
      .then(setAnalyticsOverview)
      .catch(() => {});
  }, [token, user?.isCompany]);

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
    if (!user) {
      router.push('/(auth)/register' as never);
      return;
    }
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

  // ── Guest state ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <ScreenContainer topInset={0} bg="#ffffff" noAnimation>
        <ScreenHeader title="Profils" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#f3f4f6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
          <Text
            style={{
              fontSize: 22,
              fontFamily: 'Inter_700Bold',
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Pierakstieties vai izveidojiet kontu
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 32,
              lineHeight: 22,
            }}
          >
            Lai skatītu pasūtījumus, saglabātu adreses un pārvaldītu kontu.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#111827',
              borderRadius: 100,
              paddingVertical: 16,
              paddingHorizontal: 40,
              width: '100%',
              alignItems: 'center',
              marginBottom: 12,
            }}
            activeOpacity={0.85}
            onPress={() => {
              haptics.light();
              router.push('/(auth)/register' as never);
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontFamily: 'Inter_600SemiBold',
                fontWeight: '600',
              }}
            >
              Izveidot kontu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 14, width: '100%', alignItems: 'center' }}
            activeOpacity={0.7}
            onPress={() => {
              haptics.light();
              router.push('/(auth)/login' as never);
            }}
          >
            <Text
              style={{
                color: '#111827',
                fontSize: 15,
                fontFamily: 'Inter_500Medium',
                fontWeight: '500',
              }}
            >
              Jau ir konts? Ieiet
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer topInset={0} bg="#ffffff" noAnimation>
      <ScreenHeader title="Profils" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Block */}
        <TouchableOpacity style={styles.profileBlock} activeOpacity={0.85} onPress={openEdit}>
          <View
            className={`w-16 h-16 rounded-full items-center justify-center mr-4 ${ROLE_THEME[mode] ? ROLE_THEME[mode].split(' ')[0] : 'bg-gray-100'}`}
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
              style={{ fontSize: 28 }}
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

        {/* Completeness Nudge — only for logged-in users with incomplete profiles */}
        {!!user && !isComplete && (
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

        {/* Analytics Mini-card — company users only */}
        {mode === 'BUYER' && user?.isCompany && (
          <TouchableOpacity
            style={[styles.cardGroup, { marginTop: 16, overflow: 'hidden' }]}
            activeOpacity={0.85}
            onPress={() => router.push('/(buyer)/(account)/analytics')}
          >
            <View className="flex-row">
              <View className="flex-1 items-center py-4 border-r border-gray-100">
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>
                  {analyticsOverview?.buyer?.monthlySpend?.slice(-1)[0]?.value != null
                    ? new Intl.NumberFormat('lv-LV', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(analyticsOverview.buyer.monthlySpend.slice(-1)[0].value)
                    : '—'}
                </Text>
                <Text className="text-xs text-gray-500 font-medium mt-0.5">Šomēnes</Text>
              </View>
              <View className="flex-1 items-center py-4">
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>
                  {analyticsOverview?.buyer?.orderBreakdown != null
                    ? analyticsOverview.buyer.orderBreakdown
                        .filter((b) => ['IN_PROGRESS', 'CONFIRMED'].includes(b.status))
                        .reduce((s, b) => s + b.count, 0)
                    : '—'}
                </Text>
                <Text className="text-xs text-gray-500 font-medium mt-0.5">Aktīvi</Text>
              </View>
            </View>
            <View className="border-t border-gray-100 px-4 py-2.5 flex-row items-center justify-between">
              <Text className="text-xs text-gray-400 font-medium">Statistika</Text>
              <ChevronRight size={14} color="#d1d5db" />
            </View>
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

        {/* Dynamic Mode-Specific Links — only for non-buyer roles */}
        {mode !== 'BUYER' && (
          <>
            <SectionHeader label="DARBĪBAS" />
            <View style={styles.cardGroup}>
              {mode === 'SUPPLIER' && (
                <>
                  <MenuItem
                    icon={Package}
                    label="Materiālu katalogs"
                    onPress={() => router.push('/(seller)/catalog')}
                  />
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
                    hideBorder
                  />
                </>
              )}
            </View>
          </>
        )}

        {/* Application Section (Only show if missing rights and in BUYER mode commonly or generally) */}
        {(!user?.canSell || !user?.canTransport) && mode === 'BUYER' && !!user?.company?.id && (
          <>
            <SectionHeader label="PIETEIKUMI" />
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
            </View>
          </>
        )}

        {/* Account section */}
        {mode === 'BUYER' && (
          <>
            <SectionHeader label="KONTS" />
            <View style={styles.cardGroup}>
              <MenuItem
                icon={Receipt}
                label="Rēķini"
                onPress={() => router.push('/(buyer)/(account)/invoices')}
              />
              <MenuItem
                icon={FileText}
                label="Dokumenti"
                onPress={() => router.push('/(buyer)/(account)/documents')}
              />
              <MenuItem
                icon={AlertCircle}
                label="Strīdi"
                onPress={() => router.push('/(buyer)/(account)/disputes')}
              />
              <MenuItem
                icon={MapPin}
                label="Saglabātās adreses"
                onPress={() => router.push('/(buyer)/(account)/saved-addresses')}
                hideBorder
              />
            </View>
          </>
        )}

        {/* B2B-only section */}
        {mode === 'BUYER' && user?.isCompany && (
          <>
            <SectionHeader label="UZŅĒMUMS" />
            <View style={styles.cardGroup}>
              <MenuItem
                icon={Calendar}
                label="Grafiki"
                onPress={() => router.push('/(buyer)/(account)/schedules')}
              />
              {/* TODO: B3 FIELDS — re-enable when physical locations are live */}
              {/* <MenuItem
                icon={Ticket}
                label="Laukuma caurlaides"
                onPress={() => router.push('/(buyer)/(account)/field-passes')}
              /> */}
              <MenuItem
                icon={ShieldCheck}
                label="Atbilstības sertifikāti"
                onPress={() => router.push('/(buyer)/(account)/certificates')}
              />
              <MenuItem
                icon={Building2}
                label="Uzņēmuma profils"
                value="b3hub.lv"
                onPress={() => {
                  haptics.light();
                  Linking.openURL('https://b3hub.lv/dashboard/company').catch(() => null);
                }}
                hideBorder
              />
            </View>
          </>
        )}

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
                className="font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
                className="font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
                className="font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1"
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
              className={`bg-gray-900 py-4 rounded-full items-center justify-center flex-row ${saving ? 'opacity-70' : ''}`}
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
      <View style={[styles.row, !hideBorder && styles.rowBorder]}>
        <View style={styles.rowIcon}>
          <Icon size={24} color="#6b7280" strokeWidth={1.5} />
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
    fontWeight: '700',
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
