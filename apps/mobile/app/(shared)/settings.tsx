/**
 * settings.tsx — Global Settings screen (all roles)
 *
 * Accessible via the sidebar "Iestatījumi" link from any role.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/ui/Toast';
import { t } from '@/lib/translations';
import {
  Bell,
  Globe,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Shield,
  KeyRound,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/lib/language-context';
import Constants from 'expo-constants';
import { colors } from '@/lib/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const ACCENT = '#111827';

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

// ── Row variants ──────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.cardItem}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>{icon}</View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={(v) => {
            haptics.light();
            onToggle(v);
          }}
          trackColor={{ false: '#e5e7eb', true: '#374151' }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  danger,
  rightSlot,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.cardItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.rowIcon}>{icon}</View>
        <Text style={[styles.rowLabel, { flex: 1 }, danger && styles.dangerLabel]}>{label}</Text>
        {rightSlot ? rightSlot : <ChevronRight size={20} color="#6b7280" />}
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user, token } = useAuth();
  const { language, setLanguage } = useLanguage();
  const fallbackHome = user?.canTransport
    ? '/(driver)/home'
    : user?.canSell
      ? '/(seller)/home'
      : '/(buyer)/home';
  const toast = useToast();

  // Notification toggles — initialised from backend user prefs
  const [pushEnabled, setPushEnabled] = useState(user?.notifPush ?? true);
  const [orderUpdates, setOrderUpdates] = useState(user?.notifOrderUpdates ?? true);
  const [jobAlerts, setJobAlerts] = useState(user?.notifJobAlerts ?? true);
  const [marketingEmails, setMarketingEmails] = useState(user?.notifMarketing ?? false);

  useEffect(() => {
    if (user) {
      setPushEnabled(user.notifPush ?? true);
      setOrderUpdates(user.notifOrderUpdates ?? true);
      setJobAlerts(user.notifJobAlerts ?? true);
      setMarketingEmails(user.notifMarketing ?? false);
    }
  }, [user?.id]);

  const savePrefs = async (patch: {
    notifPush?: boolean;
    notifOrderUpdates?: boolean;
    notifJobAlerts?: boolean;
    notifMarketing?: boolean;
  }) => {
    if (!token) return;
    try {
      await api.updateNotificationPrefs(patch, token);
      toast.success('Saglabāts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Neizdevās saglabāt iestatījumus');
    }
  };

  const handleLogout = () => {
    haptics.warning();
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

  const [deleting, setDeleting] = useState(false);

  /**
   * GDPR Article 17 — Right to erasure.
   * Calls DELETE /auth/me which anonymises PII and deactivates the account.
   * Required by Apple App Store guideline 5.1.1.
   */
  const handleDeleteAccount = () => {
    if (!token) return;
    haptics.warning();
    Alert.alert(
      'Dzēst kontu',
      'Jūsu konts tiks neatgriezeniski anonimizēts. Personas dati tiek dzēsti nekavējoties. Finanšu dokumenti tiek saglabāti saskaņā ar likumu (līdz 5 gadiem).\n\nVai turpināt?',
      [
        { text: 'Atcelt', style: 'cancel' },
        {
          text: 'Dzēst kontu',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteAccount(token);
              haptics.success();
              await logout();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Neizdevās dzēst kontu');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer standalone>
      <ScreenHeader
        title={t.nav.settings}
        onBack={() => (router.canGoBack() ? router.back() : router.replace(fallbackHome))}
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Profile Header — auth only ─────────────── */}
        {user && (
          <View style={styles.profileHeader}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{user.email?.charAt(0).toUpperCase() || 'U'}</Text>
            </View>
            <Text style={styles.profileName}>{user.email?.split('@')[0]}</Text>
            <View style={styles.profileBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{user.email}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {user.userType === 'BUYER' ? 'Pircējs' : 'Administrators'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Notifications — auth only ─────────────────── */}
        {user && (
          <>
            <SectionHeader label="PAZIŅOJUMI" />
            <View style={styles.cardGroup}>
              <ToggleRow
                icon={<Bell size={20} color="#6b7280" />}
                label="Push paziņojumi"
                description="Saņemt paziņojumus uz ierīci"
                value={pushEnabled}
                onToggle={(v) => {
                  setPushEnabled(v);
                  savePrefs({ notifPush: v });
                }}
              />
              <ToggleRow
                icon={<Bell size={20} color="#6b7280" />}
                label="Pasūtījumu atjauninājumi"
                description="Statusa izmaiņas jūsu pasūtījumiem"
                value={orderUpdates}
                onToggle={(v) => {
                  setOrderUpdates(v);
                  savePrefs({ notifOrderUpdates: v });
                }}
              />
              <ToggleRow
                icon={<Bell size={20} color="#6b7280" />}
                label="Jaunumi un paziņojumi"
                description="Informācija par jaunumiem un piedāvājumiem"
                value={jobAlerts}
                onToggle={(v) => {
                  setJobAlerts(v);
                  savePrefs({ notifJobAlerts: v });
                }}
              />
              <ToggleRow
                icon={<Bell size={20} color="#6b7280" />}
                label="Mārketinga e-pasti"
                description="Jaunumi, piedāvājumi un atjauninājumi"
                value={marketingEmails}
                onToggle={(v) => {
                  setMarketingEmails(v);
                  savePrefs({ notifMarketing: v });
                }}
              />
            </View>
          </>
        )}

        {/* ── Language — always visible ─────────────────── */}
        <SectionHeader label="VALODA" />
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.cardItem}
            onPress={() => {
              haptics.light();
              language === 'lv' ? setLanguage('ru') : setLanguage('lv');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Globe size={20} color="#6b7280" />
              </View>
              <Text style={[styles.rowLabel, { flex: 1 }]}>Valoda / Язык</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.langOpt, language === 'lv' && styles.langOptActive]}>LV</Text>
                <Text style={{ color: '#d1d5db' }}>|</Text>
                <Text style={[styles.langOpt, language === 'ru' && styles.langOptActive]}>RU</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Legal & Support ───────────────────────────── */}
        <SectionHeader label="JURIDISKĀ INFORMĀCIJA" />
        <View style={styles.cardGroup}>
          <LinkRow
            icon={<Shield size={20} color="#6b7280" />}
            label="Privātuma politika"
            onPress={() => Linking.openURL('https://b3hub.lv/privacy')}
          />
          <LinkRow
            icon={<Lock size={20} color="#6b7280" />}
            label="Lietošanas noteikumi"
            onPress={() => Linking.openURL('https://b3hub.lv/terms')}
          />
          <LinkRow
            icon={<HelpCircle size={20} color="#6b7280" />}
            label="Palīdzība un atbalsts"
            onPress={() => Linking.openURL('mailto:support@b3hub.lv')}
          />
        </View>

        {/* ── App info ──────────────────────────────────── */}
        <SectionHeader label="PAR LIETOTNI" />
        <View style={styles.cardGroup}>
          <View style={styles.cardItem}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Info size={20} color="#6b7280" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Versija</Text>
                <Text style={styles.rowDesc}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Account — auth only ───────────────────────── */}
        {user ? (
          <>
            <SectionHeader label="KONTS" />
            <View style={styles.cardGroup}>
              <LinkRow
                icon={<KeyRound size={20} color="#6b7280" />}
                label="Nomainīt paroli"
                onPress={() => {
                  haptics.light();
                  router.push('/change-password');
                }}
                rightSlot={
                  <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 16 }}>{'>>>'}</Text>
                }
              />
              <LinkRow
                icon={<LogOut size={20} color="#ef4444" />}
                label="Izrakstīties"
                onPress={handleLogout}
                danger
              />
              <LinkRow
                icon={<Trash2 size={20} color="#ef4444" />}
                label="Dzēst kontu"
                onPress={handleDeleteAccount}
                danger
                rightSlot={
                  deleting ? <ActivityIndicator size="small" color="#ef4444" /> : undefined
                }
              />
            </View>
          </>
        ) : (
          <View style={styles.guestSignInPrompt}>
            <Text style={styles.guestSignInText}>
              Pierakstieties, lai pārvaldītu kontu, paziņojumus un paroli
            </Text>
            <TouchableOpacity
              style={styles.guestSignInBtn}
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/login' as never);
              }}
            >
              <Text style={styles.guestSignInBtnText}>Ieiet kontā</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                haptics.light();
                router.push('/(auth)/register' as never);
              }}
            >
              <Text style={styles.guestRegisterText}>Nav konta? Reģistrēties</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottom} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f6f8fb', // Soft light blue-grey match the image
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '600',
    color: '#3b82f6',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  profileBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  cardGroup: {
    gap: 12,
    paddingHorizontal: 16,
  },
  cardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 0,
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
    paddingVertical: 16,
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
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dangerLabel: {
    color: '#ef4444',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bgMuted,
    marginLeft: 56,
  },
  comingSoonBadge: {
    backgroundColor: colors.bgMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  langOpt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  langOptActive: {
    color: colors.textPrimary,
  },
  guestSignInPrompt: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  guestSignInText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  guestSignInBtn: {
    backgroundColor: '#166534',
    borderRadius: 100,
    paddingVertical: 13,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  guestSignInBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  guestRegisterText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  bottom: {
    height: 40,
  },
});
