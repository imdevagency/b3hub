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
  Calendar,
  Volume2,
  User,
  ArrowLeft
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/lib/language-context';
import Constants from 'expo-constants';
import { colors } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ── Row variants ──────────────────────────────────────────────────────────────

function LinkRow({
  icon,
  label,
  description,
  onPress,
  danger,
  rightSlot,
  hideDivider
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  danger?: boolean;
  rightSlot?: React.ReactNode;
  hideDivider?: boolean;
}) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.rowIconBase}>{icon}</View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowLabel, danger && styles.dangerLabel]}>{label}</Text>
          {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
        </View>
        {rightSlot ? rightSlot : <ChevronRight size={20} color="#9ca3af" />}
      </TouchableOpacity>
      {!hideDivider && <View style={styles.divider} />}
    </>
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
  const insets = useSafeAreaInsets();

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHome))}
          hitSlop={20}
        >
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.mainTitle}>{t.nav.settings}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.cardGroup}>
          <LinkRow
            icon={<Volume2 size={24} color="#4b5563" />}
            label="Paziņojumi"
            onPress={() => {}}
          />
          
          <LinkRow
            icon={<Calendar size={24} color="#4b5563" />}
            label="Kalendārs"
            description="Pārvaldiet savu grafiku"
            onPress={() => {}}
          />
          
          <LinkRow
            icon={<Globe size={24} color="#4b5563" />}
            label="Valoda / Язык"
            onPress={() => {
              haptics.light();
              language === 'lv' ? setLanguage('ru') : setLanguage('lv');
            }}
            rightSlot={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.langOpt, language === 'lv' && styles.langOptActive]}>LV</Text>
                <Text style={{ color: '#d1d5db' }}>|</Text>
                <Text style={[styles.langOpt, language === 'ru' && styles.langOptActive]}>RU</Text>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            }
          />
          
          <LinkRow
            icon={<User size={24} color="#4b5563" />}
            label="Privātums"
            description="Pārvaldiet savus datus un atļaujas"
            onPress={() => Linking.openURL('https://b3hub.lv/privacy')}
          />
          
          <LinkRow
            icon={<Lock size={24} color="#4b5563" />}
            label="Drošība"
            description="Paroles un autentifikācija"
            onPress={() => {
              if (user) {
                router.push('/change-password');
              } else {
                router.push('/(auth)/login' as never);
              }
            }}
          />
          
          <LinkRow
            icon={<Shield size={24} color="#4b5563" />}
            label="Juridiskā informācija"
            onPress={() => Linking.openURL('https://b3hub.lv/terms')}
            hideDivider
          />
        </View>
        <View style={styles.logoutCard}>
            <LinkRow
              icon={<LogOut size={24} color="#4b5563" />}
              label="Izrakstīties"
              onPress={handleLogout}
              hideDivider
              rightSlot={<View />}
            />
            {user && (
              <>
                 <View style={styles.divider} />
                 <LinkRow
                  icon={<Trash2 size={24} color="#ef4444" />}
                  label="Dzēst kontu"
                  onPress={handleDeleteAccount}
                  danger
                  hideDivider
                  rightSlot={
                    deleting ? <ActivityIndicator size="small" color="#ef4444" /> : <View />
                  }
                />
              </>
            )}
        </View>

        {!user && (
          <View style={styles.guestSignInPrompt}>
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
          </View>
        )}

        <View style={{ alignItems: 'center', marginTop: 24, paddingBottom: 40 }}>
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>Versija {APP_VERSION}</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
  },
  mainTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#111827',
    marginTop: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
  },
  cardGroup: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logoutCard: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 16,
  },
  rowIconBase: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  rowDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6b7280',
  },
  dangerLabel: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 64, // 24 + 24 + 16
  },
  langOpt: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#9ca3af',
  },
  langOptActive: {
    color: '#111827',
  },
  guestSignInPrompt: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  guestSignInBtn: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestSignInBtnText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  }
});
