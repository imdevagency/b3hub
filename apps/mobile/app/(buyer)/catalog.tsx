import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Search,
  X,
  PackageSearch,
  Layers,
  Leaf,
  Mountain,
  Recycle,
  Waves,
  Zap,
  MoreHorizontal,
  Box,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ApiMaterial, MaterialCategory, MaterialUnit } from '@/lib/api';
import { CATEGORY_LABELS, UNIT_SHORT } from '@/lib/materials';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 12) / 2;

// CATEGORY_LABELS — imported from @/lib/materials

type CatMeta = { bg: string; accent: string; pillBg: string; icon: React.ElementType };

const CATEGORY_META: Record<MaterialCategory | 'ALL', CatMeta> = {
  ALL: { bg: '#f3f4f6', accent: '#111827', pillBg: '#111827', icon: Layers },
  SAND: { bg: '#fef3c7', accent: '#d97706', pillBg: '#d97706', icon: Waves },
  GRAVEL: { bg: '#e2e8f0', accent: '#475569', pillBg: '#475569', icon: Mountain },
  STONE: { bg: '#dde1e8', accent: '#334155', pillBg: '#334155', icon: Mountain },
  CONCRETE: { bg: '#f0f0f0', accent: '#6b7280', pillBg: '#6b7280', icon: Box },
  SOIL: { bg: '#fefce8', accent: '#92400e', pillBg: '#92400e', icon: Layers },
  RECYCLED_CONCRETE: { bg: '#dcfce7', accent: '#16a34a', pillBg: '#16a34a', icon: Recycle },
  RECYCLED_SOIL: { bg: '#d1fae5', accent: '#059669', pillBg: '#059669', icon: Recycle },
  ASPHALT: { bg: '#e5e5e5', accent: '#44403c', pillBg: '#44403c', icon: Zap },
  CLAY: { bg: '#ffedd5', accent: '#c2410c', pillBg: '#c2410c', icon: Layers },
  OTHER: { bg: '#f3f4f6', accent: '#6b7280', pillBg: '#6b7280', icon: MoreHorizontal },
};

// UNIT_SHORT — imported from @/lib/materials

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Array<MaterialCategory | 'ALL'>;

// ── Category Pill ───────────────────────────────────────────────

function CategoryPill({
  cat,
  selected,
  onPress,
}: {
  cat: MaterialCategory | 'ALL';
  selected: boolean;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[cat];
  const Icon = meta.icon;
  return (
    <TouchableOpacity
      style={[s.pill, selected && { backgroundColor: meta.pillBg, borderColor: meta.pillBg }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={13} color={selected ? '#fff' : '#6b7280'} strokeWidth={2} />
      <Text style={[s.pillLabel, selected && s.pillLabelSelected]}>{CATEGORY_LABELS[cat]}</Text>
    </TouchableOpacity>
  );
}

// ── Product Card ────────────────────────────────────────────────

function ProductCard({ material, onPress }: { material: ApiMaterial; onPress: () => void }) {
  const meta = CATEGORY_META[material.category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;
  const imageH = Math.round(CARD_W * 0.72);

  return (
    <TouchableOpacity
      style={[s.productCard, { width: CARD_W }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Photo / illustration area */}
      <View style={[s.productImg, { height: imageH, backgroundColor: meta.bg }]}>
        <Icon size={44} color={meta.accent} strokeWidth={1.2} />

        {material.isRecycled && (
          <View style={s.ecoBadge}>
            <Leaf size={9} color="#16a34a" strokeWidth={2.5} />
            <Text style={s.ecoBadgeText}>Eco</Text>
          </View>
        )}

        {/* Price chip */}
        <View style={s.priceBadge}>
          <Text style={s.priceBadgeAmount}>
            {'ex \u20ac' + material.basePrice.toFixed(2) + '/' + UNIT_SHORT[material.unit]}
          </Text>
          <Text style={s.priceBadgeSub}>{'Franco b\u016bvlaukums'}</Text>
        </View>
      </View>

      {/* Name row */}
      <View style={s.productBody}>
        <Text style={s.productName} numberOfLines={2}>
          {material.name}
        </Text>
        {material.supplier?.name ? (
          <Text style={s.productSupplier} numberOfLines={1}>
            {material.supplier.name}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ──────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterOpacity = useRef(new Animated.Value(1)).current;

  const loadMaterials = useCallback(
    async (q?: string, cat?: MaterialCategory | 'ALL', isFilter = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (isFilter) {
        setFiltering(true);
        Animated.timing(filterOpacity, {
          toValue: 0.45,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }
      const params: Record<string, string> = {};
      if (q?.trim()) params.search = q.trim();
      if (cat && cat !== 'ALL') params.category = cat;
      try {
        const data = await api.materials.getAll(token, params);
        setMaterials(data);
      } catch {
        /* keep previous */
      } finally {
        setLoading(false);
        setRefreshing(false);
        setFiltering(false);
        Animated.timing(filterOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [token, filterOpacity],
  );

  useFocusEffect(
    useCallback(() => {
      loadMaterials('', 'ALL');
    }, [loadMaterials]),
  );

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMaterials(text, category, true), 400);
  };

  const selectCategory = (cat: MaterialCategory | 'ALL') => {
    setCategory(cat);
    loadMaterials(search, cat, true);
  };

  const handleOrder = (mat: ApiMaterial) => {
    router.push({
      pathname: '/order-request',
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
  };

  const categoryLabel = category === 'ALL' ? 'Visi materi\u0101li' : CATEGORY_LABELS[category];

  return (
    <ScreenContainer bg="#f2f2f7">
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>{'Materi\u0101lu katalogs'}</Text>
          <Text style={s.headerTitle}>{'Izv\u0113lieties produktu'}</Text>
        </View>
        {filtering && <ActivityIndicator size="small" color="#111827" />}
      </View>

      {/* ── Search bar ─────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={16} color="#9ca3af" strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            placeholder={'Mekl\u0113t materi\u0101lus...'}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                loadMaterials('', category, true);
              }}
              hitSlop={12}
            >
              <View style={s.clearBtn}>
                <X size={10} color="#fff" strokeWidth={3} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Category pills ──────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsRow}
        style={s.pillsScroll}
      >
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat}
            cat={cat}
            selected={category === cat}
            onPress={() => selectCategory(cat)}
          />
        ))}
      </ScrollView>

      {/* ── Product grid ─────────────────────────────────────── */}
      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: filterOpacity }}>
          <FlatList
            key="grid"
            data={materials}
            numColumns={2}
            keyExtractor={(m) => m.id}
            columnWrapperStyle={s.gridRow}
            contentContainerStyle={s.gridContent}
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
            ListHeaderComponent={
              <View style={s.listHeader}>
                <Text style={s.sectionTitle}>{categoryLabel}</Text>
                {materials.length > 0 && (
                  <Text style={s.sectionCount}>{materials.length + ' produkti'}</Text>
                )}
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon={<PackageSearch size={32} color="#9ca3af" strokeWidth={1.3} />}
                title={'Nav atrasts neviens materi\u0101ls'}
                subtitle={
                  'M\u0113\u0123iniet main\u012bt mekl\u0113\u0161anas vai kategorijas filtru'
                }
                action={
                  search.length > 0 || category !== 'ALL' ? (
                    <TouchableOpacity
                      style={s.emptyReset}
                      onPress={() => {
                        setSearch('');
                        selectCategory('ALL');
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={s.emptyResetText}>{'Not\u012br\u012bt filtrus'}</Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            }
            ListFooterComponent={
              materials.length > 0 ? (
                <View style={s.note}>
                  <SlidersHorizontal size={13} color="#6b7280" strokeWidth={2} />
                  <Text style={s.noteTitle}>{'Nor\u0101d\u012bt\u0101 cena'}</Text>
                  <Text style={s.noteText}>
                    {
                      'Cena "franco b\u016bvlaukums" pas\u016bt\u012bjumam ar vienu pilnu kravas auto (Sattelkipper).'
                    }
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ProductCard material={item} onPress={() => handleOrder(item)} />
            )}
          />
        </Animated.View>
      )}
    </ScreenContainer>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillsScroll: { flexGrow: 0 },
  pillsRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  pillLabelSelected: {
    color: '#fff',
  },

  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 12,
    flexGrow: 1,
  },
  gridRow: {
    gap: 12,
    justifyContent: 'flex-start',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
  },

  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImg: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ecoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ecoBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  priceBadgeAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  priceBadgeSub: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '400',
    marginTop: 1,
  },
  productBody: {
    padding: 11,
    gap: 3,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },
  productSupplier: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '400',
  },

  emptyReset: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyResetText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  note: {
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  noteText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
});
