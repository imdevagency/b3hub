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
  Check,
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
import { BottomSheet } from '@/components/ui/BottomSheet';
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

// Product Card 

function ProductCard({ material, onPress }: { material: ApiMaterial; onPress: () => void }) {
  const meta = CATEGORY_META[material.category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;
  const imageH = Math.round(CARD_W * 0.85);

  return (
    <TouchableOpacity
      style={[s.productCard, { width: CARD_W }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Photo / illustration area */}
      <View style={[s.productImg, { height: imageH, backgroundColor: meta.bg }]}>
        <Icon size={48} color={meta.accent} strokeWidth={1} />
        {material.isRecycled && (
          <View style={s.ecoBadge}>
            <Leaf size={12} color="#16a34a" strokeWidth={2.5} />
          </View>
        )}
      </View>

      {/* Name & Info */}
      <View style={s.productBody}>
        <Text style={s.productName} numberOfLines={2}>
          {material.name}
        </Text>
        {material.supplier?.name ? (
          <Text style={s.productSupplier} numberOfLines={1}>
            {material.supplier.name}
          </Text>
        ) : null}

        <View style={s.priceBox}>
          <Text style={s.priceAmount}>
            {'ex €' + material.basePrice.toFixed(2)}
            <Text style={s.priceUnit}>{' / ' + UNIT_SHORT[material.unit]}</Text>
          </Text>
          <Text style={s.priceSub}>{'Franco būvlaukums'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Screen 

export default function CatalogScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
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
      pathname: '/order-request-new',
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
    <ScreenContainer bg="#f9fafb">
      {/*  Header  */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>{'Materi\u0101lu katalogs'}</Text>
          <Text style={s.headerTitle}>{'Izv\u0113lieties produktu'}</Text>
        </View>
        {filtering && <ActivityIndicator size="small" color="#111827" />}
      </View>

      {/*  Search & Filters  */}
      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <View style={s.searchBar}>
            <Search size={18} color="#6b7280" strokeWidth={2.5} />
            <TextInput
              style={s.searchInput}
              placeholder={'Meklēt materiālus...'}
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
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={s.clearBtn}
              >
                <X size={12} color="#fff" strokeWidth={3} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.filterBtn, category !== 'ALL' && s.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.8}
          >
            <SlidersHorizontal
              size={20}
              color={category !== 'ALL' ? '#fff' : '#111827'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {category !== 'ALL' && (
          <View style={s.activeFilterRow}>
            <TouchableOpacity
              style={s.activeFilterChip}
              onPress={() => selectCategory('ALL')}
              activeOpacity={0.7}
            >
              <Text style={s.activeFilterText}>{CATEGORY_LABELS[category]}</Text>
              <View style={s.activeFilterClear}>
                <X size={14} color="#111827" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/*  Product grid  */}
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
      {/*  Filter Modal  */}
      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrēt materiālus"
        scrollable={true}
      >
        <View style={s.filterContent}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.filterOption, isSelected && s.filterOptionSelected]}
                activeOpacity={0.7}
                onPress={() => {
                  selectCategory(cat);
                  setFilterOpen(false);
                }}
              >
                <View style={s.filterOptionLeft}>
                  <View style={[s.filterOptionIcon, { backgroundColor: meta.bg }]}>
                    <Icon size={20} color={meta.accent} strokeWidth={1.5} />
                  </View>
                  <Text style={[s.filterOptionLabel, isSelected && s.filterOptionLabelSelected]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </View>
                {isSelected && <Check size={20} color="#111827" strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

// Styles 

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
    paddingBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
    fontWeight: '500',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  activeFilterRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  activeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activeFilterClear: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 16,
    flexGrow: 1,
  },
  gridRow: {
    gap: 16,
    justifyContent: 'flex-start',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
  },

  productCard: {
    backgroundColor: 'transparent',
  },
  productImg: {
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  ecoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    padding: 6,
  },
  productBody: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  productSupplier: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 6,
  },
  priceBox: {
    marginTop: 'auto',
    alignItems: 'flex-start',
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  priceUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  priceSub: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },

  filterContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 4,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  filterOptionSelected: {
    // optional selected style
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  filterOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  filterOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  filterOptionLabelSelected: {
    color: '#111827',
    fontWeight: '700',
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
