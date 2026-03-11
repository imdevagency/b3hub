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
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Globe,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Shield,
  KeyRound,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';

const APP_VERSION = '1.0.0';
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
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, danger && styles.dangerLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user, token } = useAuth();

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
    } catch {
      /* silent */
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
          router.replace('/(auth)/welcome' as any);
        },
      },
    ]);
  };

  return (
    <ScreenContainer standalone>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={ACCENT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Iestatījumi</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Notifications ─────────────────────────────── */}
        <SectionHeader label="PAZIŅOJUMI" />
        <View style={styles.card}>
          <ToggleRow
            icon={<Bell size={18} color="#6b7280" />}
            label="Push paziņojumi"
            description="Saņemt paziņojumus uz ierīci"
            value={pushEnabled}
            onToggle={(v) => {
              setPushEnabled(v);
              savePrefs({ notifPush: v });
            }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={<Bell size={18} color="#6b7280" />}
            label="Pasūtījumu atjauninājumi"
            description="Statusa izmaiņas jūsu pasūtījumiem"
            value={orderUpdates}
            onToggle={(v) => {
              setOrderUpdates(v);
              savePrefs({ notifOrderUpdates: v });
            }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={<Bell size={18} color="#6b7280" />}
            label="Darbu brīdinājumi"
            description="Jaunu transporta darbu paziņojumi"
            value={jobAlerts}
            onToggle={(v) => {
              setJobAlerts(v);
              savePrefs({ notifJobAlerts: v });
            }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={<Bell size={18} color="#6b7280" />}
            label="Mārketinga e-pasti"
            description="Jaunumi, piedāvājumi un atjauninājumi"
            value={marketingEmails}
            onToggle={(v) => {
              setMarketingEmails(v);
              savePrefs({ notifMarketing: v });
            }}
          />
        </View>

        {/* ── Language ──────────────────────────────────── */}
        <SectionHeader label="VALODA" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Globe size={18} color="#6b7280" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Lietotnes valoda</Text>
              <Text style={styles.rowDesc}>Latviešu</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Drīzumā</Text>
            </View>
          </View>
        </View>

        {/* ── Legal & Support ───────────────────────────── */}
        <SectionHeader label="JURIDISKĀ INFORMĀCIJA" />
        <View style={styles.card}>
          <LinkRow
            icon={<Shield size={18} color="#6b7280" />}
            label="Privātuma politika"
            onPress={() => Linking.openURL('https://b3hub.lv/privacy')}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<Lock size={18} color="#6b7280" />}
            label="Lietošanas noteikumi"
            onPress={() => Linking.openURL('https://b3hub.lv/terms')}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<HelpCircle size={18} color="#6b7280" />}
            label="Palīdzība un atbalsts"
            onPress={() => Linking.openURL('mailto:support@b3hub.lv')}
          />
        </View>

        {/* ── App info ──────────────────────────────────── */}
        <SectionHeader label="PAR LIETOTNI" />
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Info size={18} color="#6b7280" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Versija</Text>
              <Text style={styles.rowDesc}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        {/* ── Account ───────────────────────────────────── */}
        <SectionHeader label="KONTS" />
        <View style={styles.card}>
          <LinkRow
            icon={<KeyRound size={18} color="#6b7280" />}
            label="Nomainīt paroli"
            onPress={() => {
              haptics.light();
              router.push('/change-password' as any);
            }}
          />
          <View style={styles.divider} />
          <LinkRow
            icon={<LogOut size={18} color="#ef4444" />}
            label="Izrakstīties"
            onPress={handleLogout}
            danger
          />
        </View>

        <View style={styles.bottom} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: ACCENT,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 28,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  rowDesc: {
    fontSize: 12,
    color: '#6b7280',
  },
  dangerLabel: {
    color: '#ef4444',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f3f4f6',
    marginLeft: 56,
  },
  comingSoonBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
  },
  bottom: {
    height: 40,
  },
});
