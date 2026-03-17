import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Plus, Pencil, Trash2, Leaf, PackageSearch, ChevronDown, Check } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_LABELS } from '@/lib/materials';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ApiMaterial, MaterialCategory, MaterialUnit } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

// CATEGORY_LABELS imported from @/lib/materials

const UNIT_LABELS: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

const CATEGORIES = (Object.keys(CATEGORY_LABELS) as string[]).filter((k) => k !== 'ALL') as MaterialCategory[];
const UNITS = Object.keys(UNIT_LABELS) as MaterialUnit[];

const CATEGORY_COLOR: Record<MaterialCategory, { bg: string; color: string }> = {
  SAND: { bg: '#f3f4f6', color: '#6b7280' },
  GRAVEL: { bg: '#f1f5f9', color: '#6b7280' },
  STONE: { bg: '#f1f5f9', color: '#374151' },
  CONCRETE: { bg: '#f4f4f5', color: '#52525b' },
  SOIL: { bg: '#f0fdf4', color: '#15803d' },
  RECYCLED_CONCRETE: { bg: '#ecfdf5', color: '#059669' },
  RECYCLED_SOIL: { bg: '#f0fdf4', color: '#111827' },
  ASPHALT: { bg: '#f1f5f9', color: '#1e293b' },
  CLAY: { bg: '#f3f4f6', color: '#374151' },
  OTHER: { bg: '#f3f4f6', color: '#6b7280' },
};

// ── Types ──────────────────────────────────────────────────────

interface ListingForm {
  name: string;
  description: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: string;
  minOrder: string;
  inStock: boolean;
  isRecycled: boolean;
}

const BLANK_FORM: ListingForm = {
  name: '',
  description: '',
  category: 'SAND',
  unit: 'TONNE',
  basePrice: '',
  minOrder: '',
  inStock: true,
  isRecycled: false,
};

// ── Listing Card ───────────────────────────────────────────────

function ListingCard({
  material,
  onEdit,
  onDelete,
}: {
  material: ApiMaterial;
  onEdit: (m: ApiMaterial) => void;
  onDelete: (m: ApiMaterial) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View
          style={[
            s.cardIconCircle,
            { backgroundColor: CATEGORY_COLOR[material.category]?.bg ?? '#f3f4f6' },
          ]}
        >
          <PackageSearch size={16} color={CATEGORY_COLOR[material.category]?.color ?? '#6b7280'} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardName} numberOfLines={1}>
            {material.name}
          </Text>
          <Text style={s.cardCategory}>{CATEGORY_LABELS[material.category]}</Text>
        </View>
        <View style={[s.stockBadge, !material.inStock && s.stockBadgeOut]}>
          <Text style={[s.stockText, !material.inStock && s.stockTextOut]}>
            {material.inStock ? 'Noliktavā' : 'Nav'}
          </Text>
        </View>
      </View>

      <View style={s.cardDivider} />

      <View style={s.cardMeta}>
        <Text style={s.cardPrice}>
          €{material.basePrice.toFixed(2)} / {UNIT_LABELS[material.unit]}
        </Text>
        {material.minOrder != null && (
          <Text style={s.cardMin}>
            Min: {material.minOrder} {UNIT_LABELS[material.unit]}
          </Text>
        )}
        {material.isRecycled && (
          <View style={s.recycledBadge}>
            <Leaf size={10} color="#15803d" />
            <Text style={s.recycledText}>Rec.</Text>
          </View>
        )}
      </View>

      {material.description ? (
        <Text style={s.cardDesc} numberOfLines={2}>
          {material.description}
        </Text>
      ) : null}

      <View style={s.cardActions}>
        <TouchableOpacity style={s.editBtn} onPress={() => onEdit(material)} activeOpacity={0.8}>
          <Pencil size={14} color="#111827" />
          <Text style={s.editBtnText}>Labot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={() => onDelete(material)}
          activeOpacity={0.8}
        >
          <Trash2 size={14} color="#111827" />
          <Text style={s.deleteBtnText}>Dzēst</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Listing Modal ──────────────────────────────────────────────

function ListingModal({
  visible,
  initial,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  initial: Partial<ApiMaterial> | null;
  onClose: () => void;
  onSave: (form: ListingForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ListingForm>(BLANK_FORM);
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initial) {
        setForm({
          name: initial.name ?? '',
          description: initial.description ?? '',
          category: initial.category ?? 'SAND',
          unit: initial.unit ?? 'TONNE',
          basePrice: initial.basePrice != null ? String(initial.basePrice) : '',
          minOrder: initial.minOrder != null ? String(initial.minOrder) : '',
          inStock: initial.inStock ?? true,
          isRecycled: initial.isRecycled ?? false,
        });
      } else {
        setForm(BLANK_FORM);
      }
    }
  }, [visible, initial]);

  const set = (key: keyof ListingForm) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [key]: v }));

  const canSave = form.name.trim().length > 0 && parseFloat(form.basePrice) > 0 && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalHandle}>
          <View style={s.handleBar} />
        </View>
        <View style={s.modalToolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={s.cancelText}>Atcelt</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>
            {initial?.id ? 'Labot sludinājumu' : 'Jauns sludinājums'}
          </Text>
          <TouchableOpacity onPress={() => onSave(form)} disabled={!canSave} hitSlop={10}>
            <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={s.formLabel}>Nosaukums *</Text>
          <TextInput
            style={s.input}
            placeholder="Piem. Baltā smiltis 0/2"
            value={form.name}
            onChangeText={set('name')}
          />

          <Text style={s.formLabel}>Apraksts</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="Papildu informācija..."
            value={form.description}
            onChangeText={set('description')}
            multiline
            numberOfLines={3}
          />

          <Text style={s.formLabel}>Kategorija *</Text>
          <TouchableOpacity
            style={s.pickerRow}
            onPress={() => setCatSheetOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={s.pickerValue}>{CATEGORY_LABELS[form.category]}</Text>
            <ChevronDown size={16} color="#6b7280" />
          </TouchableOpacity>

          <Text style={s.formLabel}>Mērvienība *</Text>
          <View style={s.row}>
            {UNITS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[s.unitChip, form.unit === unit && s.chipActive]}
                onPress={() => set('unit')(unit)}
              >
                <Text style={[s.chipText, form.unit === unit && s.chipTextActive]}>
                  {UNIT_LABELS[unit]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.formLabel}>Cena (€) *</Text>
          <TextInput
            style={s.input}
            placeholder="0.00"
            value={form.basePrice}
            onChangeText={set('basePrice')}
            keyboardType="decimal-pad"
          />

          <Text style={s.formLabel}>Minimālais pasūtījums</Text>
          <TextInput
            style={s.input}
            placeholder="—"
            value={form.minOrder}
            onChangeText={set('minOrder')}
            keyboardType="decimal-pad"
          />

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Noliktavā</Text>
            <Switch
              value={form.inStock}
              onValueChange={(v) => set('inStock')(v)}
              trackColor={{ true: '#111827', false: '#d1d5db' }}
              thumbColor="#fff"
            />
          </View>
          <View style={s.toggleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Leaf size={15} color="#15803d" />
              <Text style={s.toggleLabel}>Pārstrādāts materiāls</Text>
            </View>
            <Switch
              value={form.isRecycled}
              onValueChange={(v) => set('isRecycled')(v)}
              trackColor={{ true: '#111827', false: '#d1d5db' }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>

        {/* Category picker overlay */}
        {catSheetOpen && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
              activeOpacity={1}
              onPress={() => setCatSheetOpen(false)}
            />
            <View style={s.catSheet}>
              <View style={s.modalHandle}>
                <View style={s.handleBar} />
              </View>
              <Text style={s.catSheetTitle}>Izvēlieties kategoriju</Text>
              <ScrollView bounces={false}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={s.catRow}
                    onPress={() => {
                      set('category')(cat);
                      setCatSheetOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.catRowText}>{CATEGORY_LABELS[cat]}</Text>
                    {form.category === cat && <Check size={16} color="#111827" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function SellerCatalog() {
  const { user, token } = useAuth();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ApiMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!token || !user) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.materials.getAll(token, { supplierId: user.id });
        setMaterials(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, user],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setModalVisible(true);
  };
  const openEdit = (m: ApiMaterial) => {
    setEditing(m);
    setModalVisible(true);
  };

  const handleSave = async (form: ListingForm) => {
    if (!token) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      unit: form.unit,
      basePrice: parseFloat(form.basePrice),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
      inStock: form.inStock,
      isRecycled: form.isRecycled,
    };
    try {
      if (editing?.id) {
        await api.materials.update(editing.id, payload, token);
      } else {
        await api.materials.create(payload as Parameters<typeof api.materials.create>[0], token);
      }
      setModalVisible(false);
      load();
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (m: ApiMaterial) => {
    Alert.alert('Dzēst sludinājumu?', `"${m.name}" tiks dzēsts.`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.materials.remove(m.id, token);
            setMaterials((prev) => prev.filter((x) => x.id !== m.id));
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās dzēst');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Mani sludinājumi</Text>
        <TouchableOpacity style={s.addBtn} onPress={openNew} activeOpacity={0.8}>
          <Plus size={18} color="#fff" />
          <Text style={s.addBtnText}>Pievienot</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonCard count={5} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
        >
          {materials.length === 0 ? (
            <EmptyState
              icon={<PackageSearch size={32} color="#9ca3af" />}
              title="Nav sludinājumu"
              subtitle="Pievienojiet savu pirmo materiālu!"
              action={
                <TouchableOpacity style={s.emptyAddBtn} onPress={openNew} activeOpacity={0.8}>
                  <Plus size={16} color="#fff" />
                  <Text style={s.addBtnText}>Pievienot materiālu</Text>
                </TouchableOpacity>
              }
            />
          ) : (
            materials.map((m) => (
              <ListingCard key={m.id} material={m} onEdit={openEdit} onDelete={handleDelete} />
            ))
          )}
        </ScrollView>
      )}

      <ListingModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        saving={saving}
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardCategory: { fontSize: 12, color: '#6b7280' },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
  },
  stockBadgeOut: { backgroundColor: '#fee2e2' },
  stockText: { fontSize: 11, fontWeight: '600', color: '#111827' },
  stockTextOut: { color: '#111827' },
  cardDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardMin: { fontSize: 12, color: '#6b7280' },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recycledText: { fontSize: 11, color: '#111827', fontWeight: '600' },
  cardDesc: { fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111827',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111827',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  modalHandle: { paddingTop: 12, alignItems: 'center' },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cancelText: { fontSize: 15, color: '#6b7280' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  saveTextDisabled: { color: '#9ca3af' },
  formScroll: { padding: 16, gap: 4, paddingBottom: 48 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { marginBottom: 4 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 4,
  },
  pickerValue: { fontSize: 15, color: '#111827' },
  catSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
    maxHeight: 420,
  },
  catSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  catRowText: { fontSize: 15, color: '#111827' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  unitChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#dcfce7', borderColor: '#111827' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#111827', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleLabel: { fontSize: 15, color: '#111827' },
});
