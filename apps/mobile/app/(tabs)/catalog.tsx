import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Leaf, ShoppingCart } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiMaterial, MaterialCategory, MaterialUnit } from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<MaterialCategory | 'ALL', string> = {
  ALL: 'Visi',
  SAND: 'Smiltis',
  GRAVEL: 'Šķembas',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Zeme',
  RECYCLED_CONCRETE: 'Rec. betons',
  RECYCLED_SOIL: 'Rec. zeme',
  ASPHALT: 'Asfalta gran.',
  CLAY: 'Māls',
  OTHER: 'Cits',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Array<MaterialCategory | 'ALL'>;

const UNIT_SHORT: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

const CATEGORY_ICON: Record<MaterialCategory | 'ALL', string> = {
  ALL: '📦',
  SAND: '🏜️',
  GRAVEL: '🪨',
  STONE: '🗿',
  CONCRETE: '🧱',
  SOIL: '🌱',
  RECYCLED_CONCRETE: '♻️',
  RECYCLED_SOIL: '🌿',
  ASPHALT: '🛣️',
  CLAY: '🟤',
  OTHER: '📦',
};

const VAT_RATE = 0.21;

function vatSummary(basePrice: number, qty: number) {
  const net = basePrice * qty;
  const vat = net * VAT_RATE;
  return { net, vat, gross: net + vat };
}

// ── Material Card ──────────────────────────────────────────────

function MaterialCard({
  material,
  onOrder,
}: {
  material: ApiMaterial;
  onOrder: (m: ApiMaterial) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIconWrap}>
          <Text style={s.cardIcon}>{CATEGORY_ICON[material.category]}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.cardName} numberOfLines={2}>
            {material.name}
          </Text>
          <Text style={s.cardSupplier} numberOfLines={1}>
            {material.supplier?.name ?? 'Nezīnāms piegādātājs'}
          </Text>
        </View>
        {material.isRecycled && (
          <View style={s.recycledBadge}>
            <Leaf size={10} color="#15803d" />
            <Text style={s.recycledText}>Rec.</Text>
          </View>
        )}
      </View>

      <View style={s.cardDivider} />

      <View style={s.cardFooter}>
        <Text style={s.cardPrice}>
          €{material.basePrice.toFixed(2)}
          <Text style={s.cardUnit}> / {UNIT_SHORT[material.unit]}</Text>
        </Text>
        <TouchableOpacity style={s.orderBtn} onPress={() => onOrder(material)} activeOpacity={0.82}>
          <ShoppingCart size={13} color="#fff" />
          <Text style={s.orderBtnText}>Pasūtīt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Order Modal ────────────────────────────────────────────────

interface OrderForm {
  quantity: string;
  address: string;
  city: string;
  postal: string;
  date: string;
}

function OrderModal({
  material,
  visible,
  onClose,
  onSubmit,
  submitting,
}: {
  material: ApiMaterial | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (form: OrderForm) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<OrderForm>({
    quantity: '1',
    address: '',
    city: '',
    postal: '',
    date: '',
  });

  useEffect(() => {
    if (visible) setForm({ quantity: '1', address: '', city: '', postal: '', date: '' });
  }, [visible]);

  if (!material) return null;

  const qty = parseFloat(form.quantity) || 0;
  const { net, vat, gross } = vatSummary(material.basePrice, qty);
  const set = (key: keyof OrderForm) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const canSubmit =
    qty > 0 &&
    form.address.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.date.trim().length > 0 &&
    !submitting;

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
            <X size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={s.modalTitle}>Pasūtīt</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {/* Material summary */}
          <View style={s.matSummaryBox}>
            <Text style={s.matSummaryName}>{material.name}</Text>
            <Text style={s.matSummaryMeta}>
              {material.supplier?.name} · €{material.basePrice.toFixed(2)} /{' '}
              {UNIT_SHORT[material.unit]}
            </Text>
          </View>

          {/* Quantity */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Daudzums ({UNIT_SHORT[material.unit]})</Text>
            <TextInput
              style={s.fieldInput}
              value={form.quantity}
              onChangeText={set('quantity')}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Address */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Piegādes adrese *</Text>
            <TextInput
              style={s.fieldInput}
              value={form.address}
              onChangeText={set('address')}
              placeholder="Ielas nosaukums, nr."
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* City + Postal */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[s.fieldGroup, { flex: 2 }]}>
              <Text style={s.fieldLabel}>Pilsēta *</Text>
              <TextInput
                style={s.fieldInput}
                value={form.city}
                onChangeText={set('city')}
                placeholder="Rīga"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={[s.fieldGroup, { flex: 1 }]}>
              <Text style={s.fieldLabel}>Indekss</Text>
              <TextInput
                style={s.fieldInput}
                value={form.postal}
                onChangeText={set('postal')}
                placeholder="LV-1001"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Date */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Piegādes datums * (GGGG-MM-DD)</Text>
            <TextInput
              style={s.fieldInput}
              value={form.date}
              onChangeText={set('date')}
              placeholder="2025-12-31"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* VAT summary */}
          {qty > 0 && (
            <View style={s.vatBox}>
              <View style={s.vatRow}>
                <Text style={s.vatLabel}>Summa bez PVN</Text>
                <Text style={s.vatVal}>€{net.toFixed(2)}</Text>
              </View>
              <View style={s.vatRow}>
                <Text style={s.vatLabel}>PVN 21%</Text>
                <Text style={s.vatVal}>€{vat.toFixed(2)}</Text>
              </View>
              <View style={[s.vatRow, s.vatTotal]}>
                <Text style={s.vatTotalLabel}>Kopā</Text>
                <Text style={s.vatTotalVal}>€{gross.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && { opacity: 0.4 }]}
            onPress={() => canSubmit && onSubmit(form)}
            activeOpacity={0.88}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Nosūtīt pasūtījumu</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { token, user } = useAuth();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [selected, setSelected] = useState<ApiMaterial | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMaterials = useCallback(
    async (q?: string, cat?: MaterialCategory | 'ALL') => {
      if (!token) {
        setLoading(false);
        return;
      }
      const params: Record<string, string> = {};
      if (q?.trim()) params.search = q.trim();
      if (cat && cat !== 'ALL') params.category = cat;
      try {
        const data = await api.materials.getAll(token, params);
        setMaterials(data);
      } catch {
        // keep previous list visible
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMaterials('', 'ALL');
  }, []);

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMaterials(text, category), 350);
  };

  const onCategory = (cat: MaterialCategory | 'ALL') => {
    setCategory(cat);
    loadMaterials(search, cat);
  };

  const handleSubmit = async (form: OrderForm) => {
    if (!token || !user || !selected) return;
    setSubmitting(true);
    try {
      await api.materials.createOrder(
        {
          buyerId: user.id,
          materialId: selected.id,
          quantity: parseFloat(form.quantity),
          unit: selected.unit,
          unitPrice: selected.basePrice,
          deliveryAddress: form.address.trim(),
          deliveryCity: form.city.trim(),
          deliveryPostal: form.postal.trim() || undefined,
          deliveryDate: form.date.trim(),
        },
        token,
      );
      setModalOpen(false);
      Alert.alert('Pasūtījums nosūtīts!', 'Jūsu pasūtījums tika veiksmīgi nosūtīts.');
    } catch {
      Alert.alert('Kļūda', 'Neizdevās nosūtīt pasūtījumu. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Search bar */}
      <View style={s.searchBar}>
        <Search size={15} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="Meklēt materiālus…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              loadMaterials('', category);
            }}
          >
            <X size={14} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsContainer}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[s.pill, category === cat && s.pillActive]}
            onPress={() => onCategory(cat)}
            activeOpacity={0.75}
          >
            <Text style={[s.pillText, category === cat && s.pillTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Materials list */}
      {loading ? (
        <ActivityIndicator color="#dc2626" size="large" style={{ marginTop: 64 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMaterials(search, category);
              }}
              tintColor="#dc2626"
            />
          }
        >
          {materials.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📦</Text>
              <Text style={s.emptyTitle}>Nav atrasts neviens materiāls</Text>
              <Text style={s.emptyDesc}>Mēģiniet mainīt meklēšanas vai kategorijas filtru</Text>
            </View>
          ) : (
            materials.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                onOrder={(mat) => {
                  setSelected(mat);
                  setModalOpen(true);
                }}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <OrderModal
        material={selected}
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  pillsContainer: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  pill: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  pillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: { fontSize: 20 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  cardSupplier: { fontSize: 12, color: '#9ca3af' },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  recycledText: { fontSize: 10, fontWeight: '600', color: '#15803d' },
  cardDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 17, fontWeight: '700', color: '#111827' },
  cardUnit: { fontSize: 12, fontWeight: '400', color: '#9ca3af' },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  orderBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center', maxWidth: 240 },

  modalHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  matSummaryBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4 },
  matSummaryName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  matSummaryMeta: { fontSize: 12, color: '#6b7280' },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  vatBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6 },
  vatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vatLabel: { fontSize: 14, color: '#6b7280' },
  vatVal: { fontSize: 14, color: '#374151', fontWeight: '500' },
  vatTotal: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  vatTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vatTotalVal: { fontSize: 18, fontWeight: '700', color: '#dc2626' },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
