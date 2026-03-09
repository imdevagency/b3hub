import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Search, X, Leaf, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
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

const CATEGORY_COLOR: Record<MaterialCategory | 'ALL', string> = {
  ALL: '#111827',
  SAND: '#111827',
  GRAVEL: '#111827',
  STONE: '#111827',
  CONCRETE: '#111827',
  SOIL: '#111827',
  RECYCLED_CONCRETE: '#111827',
  RECYCLED_SOIL: '#111827',
  ASPHALT: '#111827',
  CLAY: '#111827',
  OTHER: '#111827',
};

const CATEGORY_BG: Record<MaterialCategory | 'ALL', string> = {
  ALL: '#f3f4f6',
  SAND: '#f3f4f6',
  GRAVEL: '#f3f4f6',
  STONE: '#f3f4f6',
  CONCRETE: '#f3f4f6',
  SOIL: '#f3f4f6',
  RECYCLED_CONCRETE: '#f0fdf4',
  RECYCLED_SOIL: '#f0fdf4',
  ASPHALT: '#f3f4f6',
  CLAY: '#f3f4f6',
  OTHER: '#f3f4f6',
};

// ── Material Card ───────────────────────────────────────────

function MaterialCard({
  material,
  onOrder,
  isLast = false,
}: {
  material: ApiMaterial;
  onOrder: (m: ApiMaterial) => void;
  isLast?: boolean;
}) {
  const iconBg = material.isRecycled ? '#f0fdf4' : '#f3f4f6';
  return (
    <TouchableOpacity
      style={[s.card, isLast && s.cardLast]}
      onPress={() => onOrder(material)}
      activeOpacity={0.92}
    >
      {/* Left: icon */}
      <View style={[s.cardIconWrap, { backgroundColor: iconBg }]}>
        <Text style={s.cardIcon}>{CATEGORY_ICON[material.category]}</Text>
      </View>

      {/* Middle: info */}
      <View style={s.cardBody}>
        <View style={s.cardTopRow}>
          <Text style={s.cardName} numberOfLines={1}>
            {material.name}
          </Text>
          {material.isRecycled && (
            <View style={s.recycledBadge}>
              <Leaf size={9} color="#15803d" />
              <Text style={s.recycledText}>Eco</Text>
            </View>
          )}
        </View>
        <Text style={s.cardSupplier} numberOfLines={1}>
          {material.supplier?.name ?? 'Nezināms piegādātājs'}
        </Text>
        <View style={s.cardMeta}>
          <View style={s.categoryPill}>
            <Text style={s.categoryPillText}>{CATEGORY_LABELS[material.category]}</Text>
          </View>
        </View>
      </View>

      {/* Right: price + arrow */}
      <View style={s.cardRight}>
        <Text style={s.cardPrice}>€{material.basePrice.toFixed(2)}</Text>
        <Text style={s.cardUnit}>/ {UNIT_SHORT[material.unit]}</Text>
        <View style={s.cardArrow}>
          <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');
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

  return (
    <ScreenContainer bg="#f8f8f8">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Katalogs</Text>
        <View style={s.headerCountBadge}>
          <Text style={s.headerCountText}>
            {loading ? '…' : materials.length}
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={s.searchBar}>
        <Search size={15} color="#9ca3af" strokeWidth={2} />
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
            hitSlop={10}
          >
            <View style={s.searchClearBtn}>
              <X size={9} color="#fff" strokeWidth={3} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsContainer}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[s.pill, active && s.pillActive]}
              onPress={() => onCategory(cat)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Materials list */}
      {loading ? (
        <SkeletonCard count={5} />
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
              tintColor="#111827"
            />
          }
        >
          {materials.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>Nav atrasts neviens materiāls</Text>
              <Text style={s.emptyDesc}>Mēģiniet mainīt meklēšanas vai kategorijas filtru</Text>
              {(search.length > 0 || category !== 'ALL') && (
                <TouchableOpacity
                  style={s.emptyReset}
                  onPress={() => {
                    setSearch('');
                    setCategory('ALL');
                    loadMaterials('', 'ALL');
                  }}
                >
                  <Text style={s.emptyResetText}>Notīrīt filtrus</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={s.cardGroup}>
            {materials.map((m, idx) => (
              <MaterialCard
                key={m.id}
                material={m}
                onOrder={(mat) => {
                  router.push({
                    pathname: '/(buyer)/order-request',
                    params: {
                      materialId: mat.id,
                      materialName: mat.name,
                      materialCategory: mat.category,
                      basePrice: mat.basePrice.toString(),
                      unit: mat.unit,
                      supplier: mat.supplier?.name ?? '',
                      supplierId: mat.supplier?.id ?? '',
                    },
                  });
                }}
                isLast={idx === materials.length - 1}
              />
            ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.8, flex: 1 },
  headerCountBadge: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  headerCountText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '400' },
  searchClearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c4c4c4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pills
  pillsContainer: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  pill: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  pillText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  // List
  list: { paddingHorizontal: 16, paddingTop: 2, gap: 12 },

  // Card group — single grouped container
  cardGroup: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Card — row layout, no individual shadow — sits inside group
  card: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ebebeb',
  },
  cardLast: { borderBottomWidth: 0 },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIcon: { fontSize: 26 },
  cardBody: { flex: 1, gap: 3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  cardSupplier: { fontSize: 12, color: '#9ca3af', fontWeight: '400' },
  cardMeta: { flexDirection: 'row', marginTop: 2 },
  categoryPill: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryPillText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  recycledText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  cardRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  cardPrice: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  cardUnit: { fontSize: 11, color: '#9ca3af', fontWeight: '400' },
  cardArrow: {
    marginTop: 6,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 64, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginTop: 4 },
  emptyDesc: { fontSize: 13, color: '#9ca3af', textAlign: 'center', maxWidth: 240, lineHeight: 19 },
  emptyReset: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  emptyResetText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ── Order modal ─────────────────────────────────────────────
  orderSafe: { flex: 1, backgroundColor: '#fff' },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  orderHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  orderHeaderPhoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orderScroll: { paddingBottom: 24 },

  orderSection: { paddingHorizontal: 20, paddingVertical: 16 },
  orderDivider: { height: 1, backgroundColor: '#f3f4f6' },
  orderSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Dropdown
  dropRow: { flexDirection: 'row', gap: 16 },
  dropLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#d1d5db',
    paddingBottom: 8,
    gap: 6,
  },
  dropBtnText: { fontSize: 17, fontWeight: '600', color: '#111827', flex: 1 },
  dropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dropSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 2,
  },
  dropSheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropOptionText: { fontSize: 16, color: '#374151' },
  dropOptionActive: { fontWeight: '700', color: '#111827' },

  // Vehicle picker
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  vehicleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: 8,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  vehicleCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  vehicleCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleEmoji: { fontSize: 36 },
  vehicleLabel: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  vehicleLabelDim: { color: '#9ca3af' },
  vehicleSublabel: { fontSize: 11, fontWeight: '400', color: '#9ca3af' },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 4,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e1b4b',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stepperBtnText: { fontSize: 28, fontWeight: '300', color: '#fff', lineHeight: 32 },
  stepperDisplay: {
    width: 130,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  stepperValue: { fontSize: 42, fontWeight: '600', color: '#111827' },

  // Details step
  summaryPill: {
    margin: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  summaryPillText: { fontSize: 13, color: '#15803d', fontWeight: '600', textAlign: 'center' },
  detailInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // Bottom bar
  orderBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  orderBottomLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  orderBottomValue: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  orderCta: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  orderCtaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
