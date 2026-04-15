/**
 * saved-addresses.tsx — Buyer: manage saved delivery addresses
 * Full CRUD: list, add, edit, delete, set default.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SavedAddress, CreateSavedAddressInput } from '@/lib/api';
import { useFocusEffect } from 'expo-router';
import { MapPin, Plus, Star, Pencil, Trash2, Check, X } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Form state ────────────────────────────────────────────────

interface FormState {
  label: string;
  address: string;
  city: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = { label: '', address: '', city: '', isDefault: false };

// ── Address Row ───────────────────────────────────────────────

interface AddressRowProps {
  item: SavedAddress;
  onEdit: (item: SavedAddress) => void;
  onDelete: (item: SavedAddress) => void;
  onSetDefault: (item: SavedAddress) => void;
  settingDefault: string | null;
}

function AddressRow({ item, onEdit, onDelete, onSetDefault, settingDefault }: AddressRowProps) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, item.isDefault && s.rowIconDefault]}>
        <MapPin size={18} color={item.isDefault ? '#ffffff' : '#6b7280'} />
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowLabel} numberOfLines={1}>
            {item.label}
          </Text>
          {item.isDefault && (
            <View style={s.defaultBadge}>
              <Star size={9} color="#fff" fill="#fff" />
              <Text style={s.defaultBadgeText}>Noklusējums</Text>
            </View>
          )}
        </View>
        <Text style={s.rowAddress} numberOfLines={1}>
          {item.address}
        </Text>
        <Text style={s.rowCity}>{item.city}</Text>
      </View>
      <View style={s.rowActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onSetDefault(item)}
            disabled={settingDefault !== null}
            activeOpacity={0.7}
          >
            {settingDefault === item.id ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Star size={15} color="#9ca3af" />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.actionBtn} onPress={() => onEdit(item)} activeOpacity={0.7}>
          <Pencil size={15} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onDelete(item)} activeOpacity={0.7}>
          <Trash2 size={15} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function SavedAddressesScreen() {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.savedAddresses.list(token);
        // Sort: default first, then by label
        setAddresses(
          [...data].sort((a, b) => {
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
            return a.label.localeCompare(b.label);
          }),
        );
      } catch {
        // silent — empty state handles it
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (item: SavedAddress) => {
    setEditingId(item.id);
    setForm({
      label: item.label,
      address: item.address,
      city: item.city,
      isDefault: item.isDefault,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!token) return;
    const trimmed = {
      label: form.label.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      isDefault: form.isDefault,
    };
    if (!trimmed.label || !trimmed.address || !trimmed.city) {
      Alert.alert('Nepilnīgi dati', 'Lūdzu aizpildi visus laukus.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.savedAddresses.update(editingId, trimmed, token);
      } else {
        await api.savedAddresses.create(trimmed, token);
      }
      haptics.success();
      closeModal();
      load();
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās saglabāt adresi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: SavedAddress) => {
    haptics.medium();
    Alert.alert('Dzēst adresi?', `"${item.label}" tiks neatgriezeniski dzēsta.`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.savedAddresses.remove(item.id, token);
            setAddresses((prev) => prev.filter((a) => a.id !== item.id));
          } catch (e) {
            Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās dzēst adresi');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (item: SavedAddress) => {
    if (!token) return;
    haptics.light();
    setSettingDefault(item.id);
    try {
      await api.savedAddresses.setDefault(item.id, token);
      setAddresses((prev) =>
        [...prev]
          .map((a) => ({ ...a, isDefault: a.id === item.id }))
          .sort((a, b) => {
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
            return a.label.localeCompare(b.label);
          }),
      );
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās iestatīt noklusējumu');
    } finally {
      setSettingDefault(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title="Saglabātās adreses" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader
        title="Saglabātās adreses"
        rightAction={
          <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={s.list}
        contentContainerStyle={addresses.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#00A878"
          />
        }
      >
        {addresses.length === 0 ? (
          <EmptyState
            icon={<MapPin size={36} color="#9ca3af" />}
            title="Nav saglabātu adresu"
            subtitle="Pievieno biežāk izmantotās piegādes adreses, lai ātrāk veidotu pasūtījumus."
            action={
              <TouchableOpacity style={s.emptyAction} onPress={openAdd} activeOpacity={0.8}>
                <Text style={s.emptyActionText}>Pievienot adresi</Text>
              </TouchableOpacity>
            }
          />
        ) : (
          <View style={s.card}>
            {addresses.map((item, idx) => (
              <View key={item.id}>
                <AddressRow
                  item={item}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  settingDefault={settingDefault}
                />
                {idx < addresses.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalRoot}
        >
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editingId ? 'Rediģēt adresi' : 'Jauna adrese'}</Text>
            <TouchableOpacity onPress={closeModal} style={s.modalClose} activeOpacity={0.7}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.modalScroll}
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.fieldLabel}>Nosaukums *</Text>
            <TextInput
              style={s.input}
              value={form.label}
              onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
              placeholder="piem. Noliktava, Objekts A"
              placeholderTextColor="#9ca3af"
            />

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Adrese *</Text>
            <TextInput
              style={s.input}
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
              placeholder="Iela, māja"
              placeholderTextColor="#9ca3af"
            />

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Pilsēta *</Text>
            <TextInput
              style={s.input}
              value={form.city}
              onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
              placeholder="Rīga"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity
              style={s.defaultToggle}
              onPress={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
              activeOpacity={0.8}
            >
              <View style={[s.checkbox, form.isDefault && s.checkboxChecked]}>
                {form.isDefault && <Check size={12} color="#ffffff" />}
              </View>
              <Text style={s.defaultToggleText}>Iestatīt kā noklusējuma adresi</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={s.modalFooter}>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.saveBtnText}>{editingId ? 'Saglabāt' : 'Pievienot'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { flex: 1 },
  listContent: { padding: 16 },
  listEmpty: { flexGrow: 1 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 68 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDefault: { backgroundColor: '#111827' },
  rowBody: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  rowAddress: { fontSize: 13, color: '#374151', marginTop: 2 },
  rowCity: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#111827',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },

  rowActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#ffffff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20 },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
  },

  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: { backgroundColor: '#111827', borderColor: '#111827' },
  defaultToggleText: { fontSize: 14, color: '#374151', fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  emptyAction: {
    marginTop: 16,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyActionText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
