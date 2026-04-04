import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import {
  Layers,
  Leaf,
  Mountain,
  Recycle,
  Waves,
  Zap,
  MoreHorizontal,
  Box,
  Search,
  X,
  Package,
  FolderOpen,
  ChevronRight,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { MaterialCategory, ApiMaterial } from '@/lib/api';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  MATERIAL_CATEGORIES,
  UNIT_SHORT,
} from '@/lib/materials';

// ── Display order — most common construction materials first ──────────────

const DISPLAY_ORDER: MaterialCategory[] = [
  'GRAVEL',
  'SAND',
  'STONE',
  'CONCRETE',
  'ASPHALT',
  'SOIL',
  'CLAY',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'OTHER',
];

// ── Category metadata ──────────────────────────────────────────────────────

type CatMeta = { bg: string; accent: string; icon: React.ElementType };

const CATEGORY_META: Record<MaterialCategory, CatMeta> = {
  SAND: { bg: '#fef3c7', accent: '#d97706', icon: Waves },
  GRAVEL: { bg: '#e2e8f0', accent: '#475569', icon: Mountain },
  STONE: { bg: '#dde1e8', accent: '#334155', icon: Mountain },
  CONCRETE: { bg: '#f0f0f0', accent: '#6b7280', icon: Box },
  SOIL: { bg: '#fefce8', accent: '#92400e', icon: Layers },
  RECYCLED_CONCRETE: { bg: '#dcfce7', accent: '#16a34a', icon: Recycle },
  RECYCLED_SOIL: { bg: '#d1fae5', accent: '#059669', icon: Recycle },
  ASPHALT: { bg: '#e5e5e5', accent: '#44403c', icon: Zap },
  CLAY: { bg: '#ffedd5', accent: '#c2410c', icon: Layers },
  OTHER: { bg: '#f3f4f6', accent: '#6b7280', icon: MoreHorizontal },
};

// ── Category card ─────────────────────────────────────────────────────────

function CategoryCard({
  category,
  hasRecycled,
  supplierCount,
  onPress,
}: {
  category: MaterialCategory;
  hasRecycled: boolean;
  supplierCount: number;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[category] ?? { bg: '#f3f4f6', accent: '#6b7280', icon: Package };
  const Icon = meta.icon;
  const description = CATEGORY_DESCRIPTIONS[category];

  return (
    <TouchableOpacity
      style={s.catCard}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.8}
    >
      {/* Left accent strip */}
      <View style={[s.catStrip, { backgroundColor: meta.accent }]} />

      {/* Icon */}
      <View style={[s.catIconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={24} color={meta.accent} strokeWidth={1.8} />
      </View>

      {/* Info */}
      <View style={s.catBody}>
        <View style={s.catNameRow}>
          <Text style={s.catName}>{CATEGORY_LABELS[category]}</Text>
          {hasRecycled && (
            <View style={s.recycledBadge}>
              <Leaf size={11} color="#16a34a" fill="#16a34a" />
              <Text style={s.recycledText}>Pārstrādāts</Text>
            </View>
          )}
        </View>
        {description ? (
          <Text style={s.catDesc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {supplierCount > 0 && (
          <Text style={s.catSupplierCount}>
            {supplierCount} piegādātāj{supplierCount === 1 ? 's' : 'i'}
          </Text>
        )}
      </View>

      {/* Arrow */}
      <View style={s.catRight}>
        <ChevronRight size={16} color="#d1d5db" />
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId;

  const [allMaterials, setAllMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [resumeDraft, setResumeDraft] = useState<{
    materialName: string;
    quantity: number;
    unit: string;
  } | null>(null);

  const DRAFT_KEY = '@b3hub_wizard_draft';
  const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

  // Check for a saved draft on every focus
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(DRAFT_KEY)
        .then((raw) => {
          if (!raw) {
            setResumeDraft(null);
            return;
          }
          try {
            const d = JSON.parse(raw);
            if (Date.now() - (d.savedAt ?? 0) > DRAFT_MAX_AGE_MS) {
              AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
              setResumeDraft(null);
              return;
            }
            setResumeDraft({ materialName: d.materialName, quantity: d.quantity, unit: d.unit });
          } catch {
            setResumeDraft(null);
          }
        })
        .catch(() => {});
    }, []),
  );

  // Fetch all materials — reload on every focus so new listings appear
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      api.materials
        .getAll(token, {})
        .then((data) => {
          setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
        })
        .catch(() => setAllMaterials([]))
        .finally(() => setLoading(false));
    }, [token]),
  );

  const handleRefresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    api.materials
      .getAll(token, {})
      .then((data) => {
        setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [token]);

  // Per-category: unique supplier count + recycled flag
  const categoryData = useMemo(() => {
    const map: Record<
      string,
      { supplierCount: number; hasRecycled: boolean; supplierIds: Set<string> }
    > = {};
    for (const m of allMaterials) {
      if (!map[m.category])
        map[m.category] = { supplierCount: 0, hasRecycled: false, supplierIds: new Set() };
      if (m.isRecycled) map[m.category].hasRecycled = true;
      map[m.category].supplierIds.add(m.supplier.id);
    }
    const result: Record<string, { supplierCount: number; hasRecycled: boolean }> = {};
    for (const [cat, d] of Object.entries(map)) {
      result[cat] = { supplierCount: d.supplierIds.size, hasRecycled: d.hasRecycled };
    }
    return result;
  }, [allMaterials]);

  // Filter categories by search query, preserving DISPLAY_ORDER
  const visibleCategories = useMemo(() => {
    const ordered = [
      ...DISPLAY_ORDER,
      ...MATERIAL_CATEGORIES.filter((c) => !DISPLAY_ORDER.includes(c)),
    ];
    if (!query.trim()) return ordered;
    const q = query.trim().toLowerCase();
    return ordered.filter(
      (cat) =>
        CATEGORY_LABELS[cat].toLowerCase().includes(q) ||
        (CATEGORY_DESCRIPTIONS[cat] ?? '').toLowerCase().includes(q) ||
        allMaterials.some((m) => m.category === cat && m.name.toLowerCase().includes(q)),
    );
  }, [query, allMaterials]);

  const handleCategoryPress = (cat: MaterialCategory) => {
    router.push({
      pathname: '/order-request-new',
      params: { initialCategory: cat, projectId: projectId || undefined },
    });
  };

  return (
    <ScreenContainer bg="#f9fafb">
      {/* ── Search bar ── */}
      <View style={s.topBar}>
        <View style={s.searchBox}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setQuery('');
              }}
              hitSlop={8}
            >
              <X size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Project context banner ── */}
      {projectId ? (
        <View style={s.projectBanner}>
          <FolderOpen size={14} color="#1d4ed8" />
          <Text style={s.projectBannerText}>Pasūtījums tiks piesaistīts projektam</Text>
        </View>
      ) : null}

      {/* ── Draft resume banner ── */}
      {resumeDraft && !query && (
        <View style={s.draftBanner}>
          <View style={{ flex: 1 }}>
            <Text style={s.draftTitle}>Nepabeigts pasūtījums</Text>
            <Text style={s.draftSub} numberOfLines={1}>
              {resumeDraft.materialName} — {resumeDraft.quantity}{' '}
              {UNIT_SHORT[resumeDraft.unit as keyof typeof UNIT_SHORT] ?? resumeDraft.unit}
            </Text>
          </View>
          <TouchableOpacity
            style={s.draftBtn}
            onPress={() =>
              router.push({
                pathname: '/order-request-new',
                params: { resumeDraft: 'true' },
              } as any)
            }
            activeOpacity={0.8}
          >
            <Text style={s.draftBtnText}>Turpināt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
              setResumeDraft(null);
            }}
          >
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Category list ── */}
      {loading ? (
        <View style={s.skeletonWrap}>
          <SkeletonCard count={6} />
        </View>
      ) : visibleCategories.length === 0 ? (
        <View style={s.empty}>
          <Package size={36} color="#d1d5db" />
          <Text style={s.emptyTitle}>Nav rezultātu</Text>
          <Text style={s.emptySub}>Izmēģiniet citu nosaukumu</Text>
        </View>
      ) : (
        <FlatList
          data={visibleCategories}
          keyExtractor={(cat) => cat}
          renderItem={({ item: cat }) => {
            const data = categoryData[cat] ?? { supplierCount: 0, hasRecycled: false };
            return (
              <CategoryCard
                category={cat}
                hasRecycled={data.hasRecycled}
                supplierCount={data.supplierCount}
                onPress={() => handleCategoryPress(cat)}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />
          }
        />
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#f9fafb',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  projectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  projectBannerText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  draftTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  draftSub: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 1,
  },
  draftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 108,
    gap: 10,
  },
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Category card
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 88,
  },
  catStrip: {
    width: 4,
    alignSelf: 'stretch',
  },
  catIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginRight: 12,
  },
  catBody: {
    flex: 1,
    paddingVertical: 12,
    gap: 2,
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  catDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginTop: 1,
  },
  catSupplierCount: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 3,
    fontWeight: '500',
  },

  catRight: {
    paddingRight: 14,
    paddingLeft: 8,
  },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recycledText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
});
