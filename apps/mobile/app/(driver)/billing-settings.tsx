import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import { useRouter } from 'expo-router';

export default function DriverBillingSettingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const token = session?.access_token ?? '';

  const [ibanNumber, setIbanNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    // POST /payments/onboard returns the current IBAN stored on the driver profile
    api
      .setupPayouts(token)
      // The actual backend response includes ibanNumber even though the TS type says { url }
      .then((res) => {
        const info = res as unknown as { ibanNumber?: string | null };
        if (info.ibanNumber) setIbanNumber(info.ibanNumber);
      })
      .catch(() => {
        /* start blank — driver can still enter IBAN */
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    const iban = ibanNumber.trim();
    if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban.replace(/\s/g, ''))) {
      Alert.alert('Kļūda', 'Lūdzu, ievadiet derīgu IBAN (piemēram: LV12HABA0001234567890).');
      return;
    }
    setSaving(true);
    try {
      await api.transportJobs.updateDriverBilling(token, iban);
      Alert.alert('Saglabāts', 'Bankas konts saglabāts.', [
        {
          text: 'Labi',
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/(driver)/more')),
        },
      ]);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās saglabāt. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer topInset={0} noAnimation>
        <ScreenHeader title="Norēķinu iestatījumi" showBack />
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Norēķinu iestatījumi" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={s.infoBanner}>
          <Text style={s.infoText}>
            Norādiet savu personīgo bankas kontu (IBAN), uz kuru B3Hub pārskaitīs jūsu izpeļņu. Pēc
            verifikācijas izmaksas tiks apstrādātas automātiski pēc katra pabeigta brauciena.
          </Text>
        </View>

        {/* IBAN */}
        <Text style={s.sectionLabel}>BANKAS REKVIZĪTI</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>IBAN numurs</Text>
          <TextInput
            style={s.input}
            value={ibanNumber}
            onChangeText={(v) => setIbanNumber(v.toUpperCase())}
            placeholder="LV12HABA0001234567890"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
          />
          <Text style={s.hint}>Jūsu personīgais vai darījumu bankas konts izmaksu saņemšanai.</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveBtnText}>Saglabāt</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },
  infoBanner: {
    backgroundColor: '#f0f9f5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d1ede3',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
  },
  saveBtn: {
    backgroundColor: '#203728',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#fff',
  },
});
