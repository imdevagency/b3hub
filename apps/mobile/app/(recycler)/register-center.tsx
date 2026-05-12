/**
 * (recycler)/register-center.tsx
 * Allows an approved recycler operator to register their waste processing facility.
 * Shown when the operator has no linked RecyclingCenter yet.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { createRecyclingCenter } from '@/lib/api';
import { colors } from '@/lib/theme';
import { CheckSquare, Square } from 'lucide-react-native';

// All waste types accepted on the platform
const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / gruži',
  BRICK: 'Ķieģeļi / mūrējums',
  WOOD: 'Koks',
  METAL: 'Metāls / tērauds',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts / māls',
  MIXED: 'Jaukti būvniecības atkritumi',
  HAZARDOUS: 'Bīstamie atkritumi',
  ASPHALT: 'Asfalta frēzēšana',
  GREEN_WASTE: 'Zaļie atkritumi',
  WEEE: 'Elektronikas atkritumi',
  OIL_WASTE: 'Eļļas atkritumi',
  TIRES: 'Riepas',
  PACKAGING_WASTE: 'Iepakojuma atkritumi',
};

const ALL_WASTE_TYPES = Object.keys(WASTE_TYPE_LABELS);

const DEFAULT_HOURS: Record<string, { open: string; close: string } | null> = {
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' },
  saturday: { open: '09:00', close: '14:00' },
  sunday: null,
};

export default function RegisterCenterScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const token = session?.access_token ?? '';

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [capacity, setCapacity] = useState('');
  const [licensed, setLicensed] = useState(false);
  const [licenceNumber, setLicenceNumber] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Ievadiet objekta nosaukumu.';
    if (!address.trim()) return 'Ievadiet adresi.';
    if (!city.trim()) return 'Ievadiet pilsētu.';
    if (!state.trim()) return 'Ievadiet novadu / reģionu.';
    if (!postalCode.trim()) return 'Ievadiet pasta indeksu.';
    if (selectedTypes.size === 0) return 'Izvēlieties vismaz vienu atkritumu veidu.';
    const cap = parseFloat(capacity);
    if (!capacity.trim() || isNaN(cap) || cap <= 0) return 'Ievadiet derīgu kapacitāti (t/dienā).';
    if (licensed && !licenceNumber.trim()) return 'Ievadiet licences numuru.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Kļūda', err);
      return;
    }
    setSaving(true);
    try {
      await createRecyclingCenter(token, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        acceptedWasteTypes: Array.from(selectedTypes),
        capacity: parseFloat(capacity),
        operatingHours: DEFAULT_HOURS,
        licensed,
        ...(licensed && licenceNumber.trim() ? { licenceNumber: licenceNumber.trim() } : {}),
      });
      Alert.alert('Reģistrēts!', 'Atkritumu savākšanas punkts ir reģistrēts veiksmīgi.', [
        {
          text: 'Labi',
          onPress: () => router.replace('/(recycler)/home'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Kļūda', e?.message ?? 'Neizdevās reģistrēt objektu. Mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Reģistrēt objektu" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={s.infoBanner}>
          <Text style={s.infoText}>
            Reģistrējiet savu atkritumu pārstrādes vai savākšanas punktu, lai B3Hub varētu novirzīt
            uz to izvedumu transporta darbus.
          </Text>
        </View>

        {/* Basic info */}
        <Text style={s.sectionLabel}>OBJEKTA INFORMĀCIJA</Text>
        <View style={s.card}>
          <Field
            label="Objekta nosaukums *"
            value={name}
            onChangeText={setName}
            placeholder="piem. SIA Ekocentrs — Rīgas bāze"
          />
          <Field
            label="Iela, mājas nr. *"
            value={address}
            onChangeText={setAddress}
            placeholder="Brīvības iela 123"
          />
          <Field label="Pilsēta *" value={city} onChangeText={setCity} placeholder="Rīga" />
          <Field
            label="Novads / reģions *"
            value={state}
            onChangeText={setState}
            placeholder="Rīgas novads"
          />
          <Field
            label="Pasta indekss *"
            value={postalCode}
            onChangeText={setPostalCode}
            placeholder="LV-1001"
            last
          />
        </View>

        {/* Capacity */}
        <Text style={s.sectionLabel}>KAPACITĀTE</Text>
        <View style={s.card}>
          <Field
            label="Kapacitāte (t/dienā) *"
            value={capacity}
            onChangeText={setCapacity}
            placeholder="50"
            keyboardType="numeric"
            last
          />
        </View>

        {/* Accepted waste types */}
        <Text style={s.sectionLabel}>PIEŅEMAMIE ATKRITUMU VEIDI *</Text>
        <View style={s.card}>
          {ALL_WASTE_TYPES.map((type, idx) => {
            const selected = selectedTypes.has(type);
            const isLast = idx === ALL_WASTE_TYPES.length - 1;
            return (
              <TouchableOpacity
                key={type}
                style={[s.checkRow, !isLast && s.checkRowBorder]}
                onPress={() => toggleType(type)}
                activeOpacity={0.7}
              >
                {selected ? (
                  <CheckSquare size={20} color="#203728" />
                ) : (
                  <Square size={20} color={colors.textMuted} />
                )}
                <Text style={[s.checkLabel, selected && s.checkLabelSelected]}>
                  {WASTE_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Licensing */}
        <Text style={s.sectionLabel}>LICENCĒŠANA</Text>
        <View style={s.card}>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Objektam ir licence</Text>
            <Switch
              value={licensed}
              onValueChange={setLicensed}
              trackColor={{ true: '#203728', false: '#e5e7eb' }}
              thumbColor="#fff"
            />
          </View>
          {licensed && (
            <Field
              label="Licences numurs"
              value={licenceNumber}
              onChangeText={setLicenceNumber}
              placeholder="piem. VVD-2024-0123"
              last
            />
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, saving && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.submitBtnText}>Reģistrēt objektu</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Simple text field component ────────────────────────────────────────────
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  last?: boolean;
}) {
  return (
    <View style={[s.fieldWrap, !last && s.fieldBorder]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },
  infoBanner: {
    backgroundColor: '#f0f9f5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d1ede3',
  },
  infoText: { fontSize: 14, color: '#374151', lineHeight: 21, fontFamily: 'Inter_400Regular' },
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
    paddingHorizontal: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fieldWrap: { paddingVertical: 14 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    backgroundColor: '#fafafa',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  checkLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    flex: 1,
  },
  checkLabelSelected: { color: '#203728', fontFamily: 'Inter_500Medium', fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  switchLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  submitBtn: {
    backgroundColor: '#203728',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#fff',
  },
});
