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
} from 'react-native';
import { MapPin, Navigation2, X } from 'lucide-react-native';
import { t } from '@/lib/translations';
import type { SearchFilter, SavedSearch } from './job-types';
import { RADIUS_OPTIONS } from './job-types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterSheetProps {
  visible: boolean;
  draft: SearchFilter;
  onChange: (f: SearchFilter) => void;
  savedSearches: SavedSearch[];
  onApply: () => void;
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
          <View style={fs.sectionCard}>
            <View style={fs.sectionHeader}>
              <MapPin size={14} color="#6b7280" />
              <Text style={fs.sectionLabel}>{t.jobSearch.fromLocation}</Text>
            </View>
            <TextInput
              style={fs.input}
              value={draft.fromLocation}
              onChangeText={(v) => onChange({ ...draft, fromLocation: v })}
              placeholder={t.jobSearch.fromPlaceholder}
              placeholderTextColor="#9ca3af"
              returnKeyType="done"
            />
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

          {/* To section */}
          <View style={fs.sectionCard}>
            <View style={fs.sectionHeader}>
              <Navigation2 size={14} color="#6b7280" />
              <Text style={fs.sectionLabel}>{t.jobSearch.toLocation}</Text>
            </View>
            <TextInput
              style={fs.input}
              value={draft.toLocation}
              onChangeText={(v) => onChange({ ...draft, toLocation: v })}
              placeholder={t.jobSearch.toPlaceholder}
              placeholderTextColor="#9ca3af"
              returnKeyType="done"
            />
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

          {/* Saved searches */}
          {savedSearches.length > 0 && (
            <View style={fs.savedSection}>
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
          )}

          {/* Save search link */}
          <TouchableOpacity style={fs.saveLink} onPress={onSaveSearch} disabled={!hasContent}>
            <Text style={[fs.saveLinkText, !hasContent && { opacity: 0.35 }]}>
              ♡ {t.jobSearch.saveSearch}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Apply CTA */}
        <View style={fs.footer}>
          <TouchableOpacity style={fs.applyBtn} onPress={onApply} activeOpacity={0.88}>
            <Text style={fs.applyBtnText}>{t.jobSearch.applyFilter}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f2f2f7',
  },
  toolbarCancel: { fontSize: 16, color: '#6b7280', fontWeight: '400', lineHeight: 22 },
  toolbarTitle: { fontSize: 16, fontWeight: '700', color: '#111827', lineHeight: 22 },
  toolbarReset: { fontSize: 16, color: '#ef4444', fontWeight: '600', lineHeight: 22 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    marginBottom: 12,
  },
  radiusRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  radChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  radChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  radChipText: { fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 18 },
  radChipTextActive: { color: '#ffffff' },
  savedSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  savedTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    lineHeight: 16,
  },
  savedChips: { flexDirection: 'row', gap: 8 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 7,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  savedChipText: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  savedChipX: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLink: { alignItems: 'center', paddingVertical: 4 },
  saveLinkText: { fontSize: 14, color: '#6b7280', fontWeight: '500', lineHeight: 20 },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
    backgroundColor: '#f2f2f7',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  applyBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff', lineHeight: 22 },
});
