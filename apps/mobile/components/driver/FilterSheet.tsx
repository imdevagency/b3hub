import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MapPin, Navigation2, X, Truck } from 'lucide-react-native';
import { t } from '@/lib/translations';
import type { SearchFilter, SavedSearch } from './job-types';
import { RADIUS_OPTIONS } from './job-types';

const VEHICLE_TYPE_LABELS: { value: string; label: string }[] = [
  { value: 'DUMP_TRUCK', label: 'Pašizgāzējs' },
  { value: 'FLATBED_TRUCK', label: 'Platforma' },
  { value: 'SEMI_TRAILER', label: 'Puspiekabe' },
  { value: 'HOOK_LIFT', label: 'Hāks' },
  { value: 'SKIP_LOADER', label: 'Konteiners' },
  { value: 'TANKER', label: 'Cisterna' },
  { value: 'VAN', label: 'Furgons' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterSheetProps {
  visible: boolean;
  draft: SearchFilter;
  onChange: (f: SearchFilter) => void;
  savedSearches: SavedSearch[];
  onApply: () => void;
  /** While true the Apply button shows a spinner */
  applyLoading?: boolean;
  onReset: () => void;
  onSaveSearch: () => void;
  onApplySaved: (s: SavedSearch) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FilterSheet({
  visible,
  draft,
  onChange,
  savedSearches,
  onApply,
  applyLoading = false,
  onReset,
  onSaveSearch,
  onApplySaved,
  onDeleteSaved,
  onClose,
}: FilterSheetProps) {
  const hasContent = draft.fromLocation.trim() || draft.toLocation.trim();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={fs.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle */}
        <View style={fs.handleWrap}>
          <View style={fs.handle} />
        </View>

        {/* Toolbar */}
        <View style={fs.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={fs.toolbarCancel}>Atcelt</Text>
          </TouchableOpacity>
          <Text style={fs.toolbarTitle}>Meklēšana</Text>
          <TouchableOpacity onPress={onReset} hitSlop={12} disabled={!hasContent}>
            <Text style={[fs.toolbarReset, !hasContent && { opacity: 0.3 }]}>Atiestatīt</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={fs.scroll}
          contentContainerStyle={fs.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* From section */}
          <View style={fs.sectionBlock}>
            <Text style={fs.sectionLabel}>{t.jobSearch.fromLocation}</Text>
            <View style={fs.inputWrap}>
              <View style={fs.inputIcon}>
                <MapPin size={18} color="#000" />
              </View>
              <TextInput
                style={fs.input}
                value={draft.fromLocation}
                onChangeText={(v) => onChange({ ...draft, fromLocation: v })}
                placeholder={t.jobSearch.fromPlaceholder}
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={fs.radiusRow}>
                {[0, ...RADIUS_OPTIONS].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[fs.radChip, draft.fromRadius === r && fs.radChipActive]}
                    onPress={() => onChange({ ...draft, fromRadius: r })}
                  >
                    <Text style={[fs.radChipText, draft.fromRadius === r && fs.radChipTextActive]}>
                      {r === 0 ? 'Jebkur' : `${r} km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Divider */}
          <View style={fs.divider} />

          {/* To section */}
          <View style={fs.sectionBlock}>
            <Text style={fs.sectionLabel}>{t.jobSearch.toLocation}</Text>
            <View style={fs.inputWrap}>
              <View style={fs.inputIcon}>
                <Navigation2 size={18} color="#000" />
              </View>
              <TextInput
                style={fs.input}
                value={draft.toLocation}
                onChangeText={(v) => onChange({ ...draft, toLocation: v })}
                placeholder={t.jobSearch.toPlaceholder}
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={fs.radiusRow}>
                {[0, ...RADIUS_OPTIONS].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[fs.radChip, draft.toRadius === r && fs.radChipActive]}
                    onPress={() => onChange({ ...draft, toRadius: r })}
                  >
                    <Text style={[fs.radChipText, draft.toRadius === r && fs.radChipTextActive]}>
                      {r === 0 ? 'Jebkur' : `${r} km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Vehicle type section */}
          <View style={fs.divider} />
          <View style={fs.sectionBlock}>
            <Text style={fs.sectionLabel}>Transporta veids</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={fs.radiusRow}>
                <TouchableOpacity
                  style={[fs.radChip, (!draft.vehicleType || draft.vehicleType === '') && fs.radChipActive]}
                  onPress={() => onChange({ ...draft, vehicleType: '' })}
                >
                  <Text style={[fs.radChipText, (!draft.vehicleType || draft.vehicleType === '') && fs.radChipTextActive]}>
                    Visi
                  </Text>
                </TouchableOpacity>
                {VEHICLE_TYPE_LABELS.map((vt) => (
                  <TouchableOpacity
                    key={vt.value}
                    style={[fs.radChip, draft.vehicleType === vt.value && fs.radChipActive]}
                    onPress={() => onChange({ ...draft, vehicleType: draft.vehicleType === vt.value ? '' : vt.value })}
                  >
                    <Text style={[fs.radChipText, draft.vehicleType === vt.value && fs.radChipTextActive]}>
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Price range section */}
          <View style={fs.divider} />
          <View style={fs.sectionBlock}>
            <Text style={fs.sectionLabel}>Cena (€)</Text>
            <View style={fs.priceRow}>
              <View style={[fs.inputWrap, fs.priceInput]}>
                <TextInput
                  style={fs.input}
                  value={draft.priceMin ? String(draft.priceMin) : ''}
                  onChangeText={(v) => onChange({ ...draft, priceMin: v ? Number(v.replace(/[^0-9]/g, '')) : 0 })}
                  placeholder="No"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
              <Text style={fs.priceSep}>—</Text>
              <View style={[fs.inputWrap, fs.priceInput]}>
                <TextInput
                  style={fs.input}
                  value={draft.priceMax ? String(draft.priceMax) : ''}
                  onChangeText={(v) => onChange({ ...draft, priceMax: v ? Number(v.replace(/[^0-9]/g, '')) : 0 })}
                  placeholder="Līdz"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>
          </View>

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <>
              <View style={fs.divider} />
              <View style={fs.sectionBlock}>
                <Text style={fs.savedTitle}>{t.jobSearch.savedSearches}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={fs.savedChips}>
                    {savedSearches.map((s) => (
                      <View key={s.id} style={fs.savedChip}>
                        <TouchableOpacity
                          onPress={() => {
                            onApplySaved(s);
                            onClose();
                          }}
                        >
                          <Text style={fs.savedChipText}>{s.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDeleteSaved(s.id)} style={fs.savedChipX}>
                          <X size={11} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </>
          )}

          {/* Save search link */}
          <TouchableOpacity style={fs.saveLink} onPress={onSaveSearch} disabled={!hasContent}>
            <Text style={[fs.saveLinkText, !hasContent && { opacity: 0.35 }]}>
              {t.jobSearch.saveSearch}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Apply CTA */}
        <View style={fs.footer}>
          <TouchableOpacity
            style={[fs.applyBtn, applyLoading && { opacity: 0.7 }]}
            onPress={onApply}
            activeOpacity={0.88}
            disabled={applyLoading}
          >
            {applyLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={fs.applyBtnText}>{t.jobSearch.applyFilter}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
  },
  toolbarCancel: { fontSize: 16, color: '#111827', fontWeight: '500', lineHeight: 22 },
  toolbarTitle: { fontSize: 18, fontWeight: '800', color: '#111827', lineHeight: 22 },
  toolbarReset: { fontSize: 16, color: '#111827', fontWeight: '500', lineHeight: 22 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 0, paddingBottom: 40, gap: 0 },
  sectionBlock: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#ffffff',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  radiusRow: { flexDirection: 'row', gap: 10, paddingRight: 20 },
  radChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  radChipActive: { backgroundColor: '#111827' },
  radChipText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  radChipTextActive: { color: '#ffffff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceInput: { flex: 1, marginBottom: 0 },
  priceSep: { fontSize: 18, color: '#9ca3af', fontWeight: '600' },

  savedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedChips: { flexDirection: 'row', gap: 10, paddingRight: 20 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    gap: 8,
  },
  savedChipText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  savedChipX: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLink: { alignItems: 'center', paddingVertical: 24, marginTop: 10 },
  saveLinkText: { fontSize: 16, color: '#111827', fontWeight: '700' },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  applyBtn: {
    backgroundColor: '#111827',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
