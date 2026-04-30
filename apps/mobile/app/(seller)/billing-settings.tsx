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

export default function BillingSettingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const token = session?.access_token ?? '';

  const [ibanNumber, setIbanNumber] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.company
      .getMyCompany(token)
      .then((company) => {
        setIbanNumber(company.ibanNumber ?? '');
        setPaymentTermsDays(
          company.paymentTermsDays != null ? String(company.paymentTermsDays) : '',
        );
      })
      .catch(() => {
        Alert.alert('Kļūda', 'Neizdevās ielādēt uzņēmuma datus.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    const days = paymentTermsDays.trim() ? parseInt(paymentTermsDays.trim(), 10) : undefined;
    if (days !== undefined && (isNaN(days) || days < 1 || days > 365)) {
      Alert.alert('Kļūda', 'Apmaksas termiņš jānorāda kā vesels skaitlis (1–365 dienas).');
      return;
    }
    const iban = ibanNumber.trim() || undefined;
    if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban.replace(/\s/g, ''))) {
      Alert.alert('Kļūda', 'Lūdzu, ievadiet derīgu IBAN (piemēram: LV12HABA0001234567890).');
      return;
    }
    setSaving(true);
    try {
      await api.company.updateMyCompany(token, {
        ibanNumber: iban ?? '',
        ...(days !== undefined && { paymentTermsDays: days }),
      });
      Alert.alert('Saglabāts', 'Norēķinu iestatījumi saglabāti.', [
        { text: 'Labi', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Kļūda', 'Neizdevās saglabāt iestatījumus. Lūdzu, mēģiniet vēlreiz.');
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
            Šie dati tiek izmantoti automātiski ģenerētos rēķinos, ko B3Hub sagatavo jūsu vārdā.
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
          <Text style={s.hint}>
            Jūsu uzņēmuma bankas konts, kas tiks norādīts izrakstītajos rēķinos.
          </Text>
        </View>

        {/* Payment terms */}
        <Text style={s.sectionLabel}>MAKSĀJUMU TERMIŅŠ</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>Apmaksas termiņš (dienas)</Text>
          <TextInput
            style={s.input}
            value={paymentTermsDays}
            onChangeText={setPaymentTermsDays}
            placeholder="14"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
          />
          <Text style={s.hint}>
            Noklusētais termiņš, cik dienu pircējam ir jāapmaksā rēķins (piemēram: 14 vai 30). Ja
            nav norādīts, tiek izmantots platformas noklusējums (14 dienas).
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.saveBtnLabel}>Saglabāt</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 48, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  infoBanner: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#166534',
    lineHeight: 20,
  },

  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textDisabled,
    lineHeight: 18,
  },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#fff',
  },
});
