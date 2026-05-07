import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getConstructionProjects, createConstructionDailyReport } from '@/lib/api';
import type { ConstructionProject } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { Check, ChevronDown, Cloud } from 'lucide-react-native';

const WEATHER_OPTIONS = ['Sauss', 'Mākoņains', 'Lietus', 'Sniegs', 'Vējains'];

export default function DailyReportNewScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();

  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteLabel, setSiteLabel] = useState('');
  const [weatherNote, setWeatherNote] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Jauna atskaite' });
      if (token) {
        getConstructionProjects(token, { status: 'ACTIVE', limit: 100 })
          .then((res) => setProjects(res.data))
          .catch(() => null);
      }
      return () => setConfig(null);
    }, [token, setConfig]),
  );

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert('Kļūda', 'Lūdzu izvēlieties projektu');
      return;
    }
    if (!token) return;
    haptics.medium();
    setSaving(true);
    try {
      await createConstructionDailyReport(
        {
          projectId,
          reportDate,
          siteLabel: siteLabel.trim() || undefined,
          weatherNote: weatherNote || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      haptics.success();
      router.back();
    } catch {
      Alert.alert('Kļūda', 'Neizdevās saglabāt atskaiti. Mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Jauna dienas atskaite" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={ls.scroll} showsVerticalScrollIndicator={false}>
        {/* Project picker */}
        <View style={ls.field}>
          <Text style={ls.label}>Projekts *</Text>
          <TouchableOpacity
            style={ls.picker}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              setShowProjectPicker(!showProjectPicker);
            }}
          >
            <Text style={[ls.pickerText, !selectedProject && ls.pickerPlaceholder]}>
              {selectedProject ? selectedProject.name : 'Izvēlieties projektu'}
            </Text>
            <ChevronDown size={16} color="#6b7280" strokeWidth={2} />
          </TouchableOpacity>
          {showProjectPicker && (
            <View style={ls.dropdownList}>
              {projects.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[ls.dropdownItem, projectId === p.id && ls.dropdownItemActive]}
                  onPress={() => {
                    setProjectId(p.id);
                    setShowProjectPicker(false);
                    haptics.light();
                  }}
                >
                  <Text
                    style={[ls.dropdownText, projectId === p.id && ls.dropdownTextActive]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {projectId === p.id && (
                    <Check size={14} color={colors.primary} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              ))}
              {projects.length === 0 && <Text style={ls.dropdownEmpty}>Nav aktīvu projektu</Text>}
            </View>
          )}
        </View>

        {/* Date */}
        <View style={ls.field}>
          <Text style={ls.label}>Datums *</Text>
          <TextInput
            style={ls.input}
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Site label */}
        <View style={ls.field}>
          <Text style={ls.label}>Objekts / vieta</Text>
          <TextInput
            style={ls.input}
            value={siteLabel}
            onChangeText={setSiteLabel}
            placeholder="piem. A bloks, 2. stāvs"
          />
        </View>

        {/* Weather */}
        <View style={ls.field}>
          <Text style={ls.label}>Laika apstākļi</Text>
          <View style={ls.weatherRow}>
            {WEATHER_OPTIONS.map((w) => (
              <TouchableOpacity
                key={w}
                style={[ls.weatherChip, weatherNote === w && ls.weatherChipActive]}
                onPress={() => {
                  haptics.light();
                  setWeatherNote(weatherNote === w ? '' : w);
                }}
              >
                <Cloud size={12} color={weatherNote === w ? '#fff' : '#6b7280'} strokeWidth={2} />
                <Text style={[ls.weatherText, weatherNote === w && ls.weatherTextActive]}>{w}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={ls.field}>
          <Text style={ls.label}>Piezīmes</Text>
          <TextInput
            style={[ls.input, ls.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Veiktie darbi, problēmas, cita informācija..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Text style={ls.hint}>
          Pēc saglabāšanas varēsiet pievienot darba rindas un iesniegt atskaiti web portālā.
        </Text>

        {/* Save */}
        <TouchableOpacity
          style={[ls.saveBtn, saving && ls.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={ls.saveBtnText}>Saglabāt atskaiti</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textarea: { height: 100, paddingTop: 11 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  pickerText: { fontSize: 15, color: '#111827', flex: 1 },
  pickerPlaceholder: { color: '#9ca3af' },
  dropdownList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownText: { fontSize: 14, color: '#374151', flex: 1 },
  dropdownTextActive: { color: colors.primary, fontWeight: '600' },
  dropdownEmpty: { padding: 14, fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  weatherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  weatherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weatherText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  weatherTextActive: { color: '#fff' },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
