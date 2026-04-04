import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useFocusEffect } from 'expo-router';
import {
  Plus,
  Pencil,
  Trash2,
  Leaf,
  PackageSearch,
  ChevronDown,
  Check,
  X,
  Zap,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_LABELS, DEFAULT_MATERIAL_NAMES, UNIT_SHORT } from '@/lib/materials';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { ApiMaterial, MaterialCategory, MaterialUnit } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

// CATEGORY_LABELS and UNIT_SHORT imported from @/lib/materials

const CATEGORIES = (Object.keys(CATEGORY_LABELS) as string[]).filter(
  (k) => k !== 'ALL',
) as MaterialCategory[];
const UNITS = Object.keys(UNIT_SHORT) as MaterialUnit[];

const CATEGORY_COLOR: Record<MaterialCategory, { bg: string; color: string }> = {
  SAND: { bg: '#fffbeb', color: '#d97706' },
  GRAVEL: { bg: '#f1f5f9', color: '#6b7280' },
  STONE: { bg: '#f3f4f6', color: '#374151' },
  CONCRETE: { bg: '#f4f4f5', color: '#52525b' },
  SOIL: { bg: '#f0fdf4', color: '#15803d' },
  RECYCLED_CONCRETE: { bg: '#ecfdf5', color: '#059669' },
  RECYCLED_SOIL: { bg: '#f0fdf4', color: '#166534' },
  ASPHALT: { bg: '#f1f5f9', color: '#1e293b' },
  CLAY: { bg: '#fff7ed', color: '#9a3412' },
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
  name: DEFAULT_MATERIAL_NAMES['SAND'],
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
  onQuickEdit,
}: {
  material: ApiMaterial;
  onEdit: (m: ApiMaterial) => void;
  onQuickEdit: (m: ApiMaterial) => void;
}) {
  const catTheme = CATEGORY_COLOR[material.category] ?? { bg: '#f3f4f6', color: '#6b7280' };

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => onEdit(material)}
      onLongPress={() => {
        haptics.medium();
        onQuickEdit(material);
      }}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      <View style={[s.iconBox, { backgroundColor: catTheme.bg }]}>
        <PackageSearch size={22} color={catTheme.color} />
      </View>

      <View style={s.cardBody}>
        <View style={s.cardRowTop}>
          <Text style={s.cardName} numberOfLines={1}>
            {material.name}
          </Text>
          <View style={s.priceRow}>
            <Text style={s.cardPrice}>
              €{material.basePrice.toFixed(2)} / {UNIT_SHORT[material.unit]}
            </Text>
            <Zap size={12} color="#9ca3af" />
          </View>
        </View>

        <View style={s.cardRowBottom}>
          <Text style={s.cardCategory}>{CATEGORY_LABELS[material.category]}</Text>

          <View style={s.metaRight}>
            {material.isRecycled && (
              <View style={s.tagRecycled}>
                <Leaf size={10} color="#059669" />
                <Text style={s.tagRecycledText}>Rec.</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.statusDot, !material.inStock && { backgroundColor: '#ef4444' }]} />
              <Text style={[s.statusText, !material.inStock && { color: '#ef4444' }]}>
                {material.inStock ? 'Noliktavā' : 'Tukšs'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Quick Edit Sheet ───────────────────────────────────────────

function QuickEditSheet({
  material,
  visible,
  onClose,
  onSaved,
  token,
}: {
  material: ApiMaterial | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: ApiMaterial) => void;
  token: string;
}) {
  const toast = useToast();
  const [price, setPrice] = useState('');
  const [inStock, setInStock] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (material && visible) {
      setPrice(String(material.basePrice));
      setInStock(material.inStock);
    }
  }, [material, visible]);

  if (!material) return null;

  const handleSave = async () => {
    if (!token) return;
    const p = parseFloat(price.replace(',', '.'));
    if (isNaN(p) || p <= 0) {
      Alert.alert('Kļūda', 'Ievadiet derīgu cenu.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.materials.update(material.id, { basePrice: p, inStock }, token);
      haptics.success();
      toast.success('Sludinājums atjaunināts!');
      onSaved(updated);
      onClose();
    } catch {
      haptics.error();
      toast.error('Neizdevās saglabāt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={material.name} scrollable={false}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {/* Price */}
        <View style={qs.row}>
          <Text style={qs.label}>Cena (€/{UNIT_SHORT[material.unit]})</Text>
          <View style={qs.inputWrap}>
            <Text style={qs.euro}>€</Text>
            <TextInput
              style={qs.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* In stock toggle */}
        <View style={qs.toggleRow}>
          <Text style={qs.label}>Pieejams noliktavā</Text>
          <Switch
            value={inStock}
            onValueChange={setInStock}
            trackColor={{ true: '#111827', false: '#e5e7eb' }}
            thumbColor="#fff"
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[qs.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={qs.saveBtnText}>Saglabāt</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const qs = StyleSheet.create({
  row: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    gap: 4,
  },
  euro: { fontSize: 16, color: '#374151', fontWeight: '600' },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBtn: {
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Listing Modal ──────────────────────────────────────────────

function ListingModal({
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  visible: boolean;
  initial: Partial<ApiMaterial> | null;
  onClose: () => void;
  onSave: (form: ListingForm) => void;
  onDelete: (id: string) => void;
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
  const isEditMode = !!initial?.id;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{isEditMode ? 'Labot sludinājumu' : 'Jauns sludinājums'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={s.closeBtn}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          {/* Main Info */}
          <View style={s.formGroup}>
            <Text style={s.label}>Nosaukums</Text>
            <TextInput
              style={s.input}
              placeholder="Piem. Baltā smiltis 0/2"
              placeholderTextColor="#9ca3af"
              value={form.name}
              onChangeText={set('name')}
            />
          </View>

          <View style={s.row2}>
            <View style={{ flex: 1.2 }}>
              <Text style={s.label}>Kategorija</Text>
              <TouchableOpacity
                style={s.pickerBtn}
                onPress={() => setCatSheetOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={s.pickerValue} numberOfLines={1}>
                  {CATEGORY_LABELS[form.category]}
                </Text>
                <ChevronDown size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 0.8 }}>
              <Text style={s.label}>Cena (€)</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                value={form.basePrice}
                onChangeText={set('basePrice')}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={s.formGroup}>
            <Text style={s.label}>Mērvienība</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsScroll}
            >
              {UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[s.chip, form.unit === unit && s.chipActive]}
                  onPress={() => set('unit')(unit)}
                >
                  <Text style={[s.chipText, form.unit === unit && s.chipTextActive]}>
                    {UNIT_SHORT[unit]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={s.formGroup}>
            <Text style={s.label}>Min. pasūtījums</Text>
            <TextInput
              style={s.input}
              placeholder="—"
              placeholderTextColor="#9ca3af"
              value={form.minOrder}
              onChangeText={set('minOrder')}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={s.formGroup}>
            <Text style={s.label}>Papildus</Text>
            <View style={s.toggleRow}>
              <Text style={s.toggleLabel}>Pieejams noliktavā</Text>
              <Switch
                value={form.inStock}
                onValueChange={(v) => set('inStock')(v)}
                trackColor={{ true: '#111827', false: '#e5e7eb' }}
                thumbColor="#fff"
              />
            </View>
            <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Leaf size={16} color={form.isRecycled ? '#15803d' : '#6b7280'} />
                <Text style={s.toggleLabel}>Pārstrādāts materiāls</Text>
              </View>
              <Switch
                value={form.isRecycled}
                onValueChange={(v) => set('isRecycled')(v)}
                trackColor={{ true: '#111827', false: '#e5e7eb' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={s.formGroup}>
            <Text style={s.label}>Apraksts</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Papildu informācija pircējiem..."
              placeholderTextColor="#9ca3af"
              value={form.description}
              onChangeText={set('description')}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Actions */}
          <View style={{ gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              style={[s.saveBtn, !canSave && { opacity: 0.5 }]}
              onPress={() => onSave(form)}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>
                  {isEditMode ? 'Saglabāt izmaiņas' : 'Izveidot sludinājumu'}
                </Text>
              )}
            </TouchableOpacity>

            {isEditMode && initial?.id && (
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => onDelete(initial.id!)}
                activeOpacity={0.8}
              >
                <Text style={s.deleteBtnText}>Dzēst sludinājumu</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Category picker overlay */}
        {catSheetOpen && (
          <View style={s.overlay}>
            <TouchableOpacity
              style={s.overlayBg}
              activeOpacity={1}
              onPress={() => setCatSheetOpen(false)}
            />
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Izvēlieties kategoriju</Text>
              <ScrollView bounces={false} style={{ maxHeight: 400 }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={s.sheetRow}
                    onPress={() => {
                      setForm((f) => {
                        const prevDefault = DEFAULT_MATERIAL_NAMES[f.category] ?? '';
                        const shouldFill = f.name === '' || f.name === prevDefault;
                        return {
                          ...f,
                          category: cat,
                          name: shouldFill ? (DEFAULT_MATERIAL_NAMES[cat] ?? f.name) : f.name,
                        };
                      });
                      setCatSheetOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={[
                          s.miniIcon,
                          { backgroundColor: CATEGORY_COLOR[cat]?.bg ?? '#f3f4f6' },
                        ]}
                      >
                        <PackageSearch size={16} color={CATEGORY_COLOR[cat]?.color ?? '#6b7280'} />
                      </View>
                      <Text
                        style={[s.sheetRowText, form.category === cat && { fontWeight: '700' }]}
                      >
                        {CATEGORY_LABELS[cat]}
                      </Text>
                    </View>
                    {form.category === cat && <Check size={18} color="#111827" />}
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
  const toast = useToast();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ApiMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickTarget, setQuickTarget] = useState<ApiMaterial | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!token || !user) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const companyId = user.company?.id;
        const params = companyId ? { supplierId: companyId } : undefined;
        const data = await api.materials.getAll(token, params);
        setMaterials(Array.isArray(data) ? data : ((data as { items: ApiMaterial[] }).items ?? []));
      } catch (err) {
        Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās ielādēt materiālus');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, user],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      toast.success(editing?.id ? 'Sludinājums atjaunināts!' : 'Sludinājums izveidots!');
      load();
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Dzēst sludinājumu?', 'Vai tiešām vēlaties dzēst šo materiālu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Dzēst',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.materials.remove(id, token);
            setMaterials((prev) => prev.filter((x) => x.id !== id));
            setModalVisible(false);
          } catch (err: unknown) {
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās dzēst');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer bg="white">
      {/* Add button */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end' }}>
        <TouchableOpacity style={s.addBtn} onPress={openNew} activeOpacity={0.8}>
          <Plus size={20} color="#fff" />
          <Text style={s.addBtnText}>Pievienot</Text>
        </TouchableOpacity>
      </View>

      {!loading && materials.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={s.countChip}>
            <Text style={s.countChipText}>{materials.length} materiāli</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={{ padding: 24, gap: 16 }}>
          <SkeletonCard count={5} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            s.list,
            materials.length === 0 && { flexGrow: 1, justifyContent: 'center' },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
        >
          {materials.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <PackageSearch size={32} color="#111827" />
              </View>
              <Text style={s.emptyTitle}>Nav sludinājumu</Text>
              <Text style={s.emptyDesc}>
                Pievienojiet savu pirmo materiālu, lai saņemtu pirkumus.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openNew} activeOpacity={0.8}>
                <Text style={s.emptyBtnText}>Pievienot materiālu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            materials.map((m) => (
              <ListingCard key={m.id} material={m} onEdit={openEdit} onQuickEdit={setQuickTarget} />
            ))
          )}
        </ScrollView>
      )}

      <ListingModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        saving={saving}
      />

      <QuickEditSheet
        material={quickTarget}
        visible={!!quickTarget}
        onClose={() => setQuickTarget(null)}
        onSaved={(updated) => {
          setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }}
        token={token ?? ''}
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
  },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  countChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  countChipText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },

  list: { paddingBottom: 60 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, paddingRight: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#111827' },

  cardRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { fontSize: 14, color: '#6b7280', fontWeight: '500' },

  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagRecycled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  tagRecycledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  statusText: { fontSize: 13, fontWeight: '600', color: '#10b981' },

  // Empty State
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    flex: 1,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  closeBtn: { padding: 4 },
  formScroll: { padding: 20, paddingBottom: 60 },
  formGroup: { marginBottom: 20 },
  row2: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  pickerBtn: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: { fontSize: 16, color: '#111827', fontWeight: '500', flex: 1 },

  chipsScroll: { gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#111827' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#ffffff' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },

  saveBtn: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },

  deleteBtn: {
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },

  // Picker Sheet
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    padding: 20,
    textAlign: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetRowText: { fontSize: 16, color: '#111827' },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
