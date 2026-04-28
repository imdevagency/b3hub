/**
 * saved-addresses.tsx — Buyer: manage saved delivery addresses
 * Full CRUD: list, add, edit, delete, set default.
 */
import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SavedAddress, CreateSavedAddressInput } from '@/lib/api';
import { useFocusEffect } from 'expo-router';
import { MapPin, Plus, Star, Pencil, Trash2, Check, X } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { t } from '@/lib/translations';
import { AddressField } from '@/components/ui/AddressField';

// ── Form state ────────────────────────────────────────────────

interface FormState {
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  label: '',
  address: '',
  city: '',
  lat: undefined,
  lng: undefined,
  isDefault: false,
};

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
        <MapPin size={20} color={item.isDefault ? '#1f8f53' : '#6b7280'} />
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowLabel} numberOfLines={1}>
            {item.label}
          </Text>
          {item.isDefault && (
            <View style={s.defaultBadge}>
              <Star size={10} color="#fff" fill="#fff" />
              <Text style={s.defaultBadgeText}>{t.savedAddresses.defaultBadge.toUpperCase()}</Text>
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
              <Star size={16} color="#6b7280" />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.actionBtn} onPress={() => onEdit(item)} activeOpacity={0.7}>
          <Pencil size={15} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => onDelete(item)} activeOpacity={0.7}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function SavedAddressesScreen() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormState>({ defaultValues: EMPTY_FORM });

  const isDefaultValue = watch('isDefault');

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
    reset(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (item: SavedAddress) => {
    setEditingId(item.id);
    reset({
      label: item.label,
      address: item.address,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
      isDefault: item.isDefault,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    reset(EMPTY_FORM);
    setEditingId(null);
  };

  const onSubmit = async (data: FormState) => {
    if (!token) return;
    const trimmed = {
      label: data.label.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      lat: data.lat,
      lng: data.lng,
      isDefault: data.isDefault,
    };
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
      toast.error(e instanceof Error ? e.message : t.savedAddresses.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: SavedAddress) => {
    haptics.medium();
    Alert.alert(t.savedAddresses.deleteTitle, t.savedAddresses.deleteMsg(item.label), [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: t.savedAddresses.deleteConfirm,
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.savedAddresses.remove(item.id, token);
            setAddresses((prev) => prev.filter((a) => a.id !== item.id));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t.savedAddresses.deleteSaved);
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
      toast.error(e instanceof Error ? e.message : t.savedAddresses.defaultError);
    } finally {
      setSettingDefault(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title={t.savedAddresses.title} />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader
        title={t.savedAddresses.title}
        rightAction={
          <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={20} color="#1f8f53" />
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
            title={t.savedAddresses.empty}
            subtitle={t.savedAddresses.emptyDesc}
            action={
              <TouchableOpacity style={s.emptyAction} onPress={openAdd} activeOpacity={0.8}>
                <Text style={s.emptyActionText}>{t.savedAddresses.addBtn}</Text>
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
            <Text style={s.modalTitle}>
              {editingId ? t.savedAddresses.modalEditTitle : t.savedAddresses.modalAddTitle}
            </Text>
            <TouchableOpacity onPress={closeModal} style={s.modalClose} activeOpacity={0.7}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.modalScroll}
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.fieldLabel}>{t.savedAddresses.fieldLabel}</Text>
            <Controller
              control={control}
              name="label"
              rules={{ required: t.savedAddresses.requiredField }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[s.input, errors.label && s.inputError]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t.savedAddresses.labelPlaceholder}
                  placeholderTextColor="#9ca3af"
                />
              )}
            />
            {errors.label && <Text style={s.fieldError}>{errors.label.message}</Text>}

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>{t.savedAddresses.fieldAddress}</Text>
            <Controller
              control={control}
              name="address"
              rules={{ required: t.savedAddresses.requiredField }}
              render={({ field: { value } }) => (
                <View style={errors.address && s.addressFieldError}>
                  <AddressField
                    value={
                      value
                        ? {
                            address: value,
                            city: watch('city'),
                            lat: watch('lat') ?? 0,
                            lng: watch('lng') ?? 0,
                          }
                        : null
                    }
                    onPick={(loc) => {
                      setValue('address', loc.address, { shouldValidate: true });
                      setValue('city', loc.city || '', { shouldValidate: true });
                      if (loc.lat) setValue('lat', loc.lat);
                      if (loc.lng) setValue('lng', loc.lng);
                    }}
                    placeholder={t.savedAddresses.addressPlaceholder}
                  />
                </View>
              )}
            />
            {errors.address && <Text style={s.fieldError}>{errors.address.message}</Text>}

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>{t.savedAddresses.fieldCity}</Text>
            <Controller
              control={control}
              name="city"
              rules={{ required: t.savedAddresses.requiredField }}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[s.input, errors.city && s.inputError]}
                  value={value}
                  onChangeText={onChange}
                  placeholder={t.savedAddresses.cityPlaceholder}
                  placeholderTextColor="#9ca3af"
                />
              )}
            />
            {errors.city && <Text style={s.fieldError}>{errors.city.message}</Text>}

            <TouchableOpacity
              style={s.defaultToggle}
              onPress={() => setValue('isDefault', !isDefaultValue)}
              activeOpacity={0.8}
            >
              <View style={[s.checkbox, isDefaultValue && s.checkboxChecked]}>
                {isDefaultValue && <Check size={12} color="#ffffff" />}
              </View>
              <Text style={s.defaultToggleText}>{t.savedAddresses.setDefault}</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={s.modalFooter}>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSubmit(onSubmit)}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.saveBtnText}>
                  {editingId ? t.savedAddresses.saveBtn : t.savedAddresses.addBtnModal}
                </Text>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { flex: 1 },
  listContent: { paddingTop: 16, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },

  card: {
    backgroundColor: colors.bgCard,
  },
  divider: { height: 1, backgroundColor: colors.bgMuted, marginLeft: 68 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDefault: { backgroundColor: '#e2e8f0' },
  rowBody: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  rowAddress: { fontSize: 14, color: '#4b5563', marginTop: 3 },
  rowCity: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1f8f53',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },

  rowActions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalRoot: { flex: 1, backgroundColor: colors.bgCard },
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
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
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

  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    height: 52,
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f3f4f6',
  },
  inputError: { borderWidth: 1.5, borderColor: colors.danger },
  addressFieldError: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.danger,
    overflow: 'hidden',
  },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: 4 },

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
    backgroundColor: colors.bgCard,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  defaultToggleText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  saveBtn: {
    backgroundColor: '#1f8f53',
    borderRadius: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  emptyAction: {
    marginTop: 20,
    backgroundColor: '#1f8f53',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
