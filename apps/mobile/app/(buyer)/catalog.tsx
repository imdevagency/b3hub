import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
} from 'react-native';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { MaterialCategory, ApiMaterial } from '@/lib/api';
import {
  CATEGORY_LABELS,
  MATERIAL_CATEGORIES,
  DEFAULT_MATERIAL_NAMES,
  UNIT_SHORT,
} from '@/lib/materials';

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

const { width } = Dimensions.get('window');
// Screen width minus padding (16*2=32) minus gap (16) divided by 2 items per row
const cardWidth = (width - 48) / 2;

// ── Category Card ──────────────────────────────────────────────────────────

function CategoryCard({ category, onPress }: { category: MaterialCategory; onPress: () => void }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const isRecycled = category.startsWith('RECYCLED');

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      {/* Icon square */}
      <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={24} color={meta.accent} strokeWidth={1.8} />
      </View>

      {/* Recycled indicator - Green leaf top right */}
      {isRecycled && (
        <View style={s.recycleBadge}>
          <Leaf size={14} color="#16a34a" fill="#16a34a" />
        </View>
      )}

      {/* Text */}
      <View style={s.cardText}>
        <Text style={s.cardName} numberOfLines={2}>
          {CATEGORY_LABELS[category]}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Search result card ─────────────────────────────────────────────────────

function MaterialSearchCard({ material, onPress }: { material: ApiMaterial; onPress: () => void }) {
  const catTheme = CATEGORY_META[material.category] ?? { bg: '#f3f4f6', accent: '#6b7280' };
  return (
    <TouchableOpacity style={sr.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[sr.iconBox, { backgroundColor: catTheme.bg }]}>
        <Package size={18} color={catTheme.accent} />
      </View>
      <View style={sr.body}>
        <View style={sr.nameRow}>
          <Text style={sr.name} numberOfLines={1}>
            {material.name}
          </Text>
          {material.isRecycled && <Leaf size={12} color="#16a34a" fill="#16a34a" />}
        </View>
        <Text style={sr.meta}>
          {material.supplier.name}
          {material.supplier.city ? ` · ${material.supplier.city}` : ''}
        </Text>
      </View>
      <View style={sr.priceCol}>
        <Text style={sr.price}>€{material.basePrice.toFixed(2)}</Text>
        <Text style={sr.unit}>/{UNIT_SHORT[material.unit] ?? material.unit}</Text>
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiMaterial[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.materials.getAll(token ?? '', { search: q });
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token]);

  const handleCategory = (category: MaterialCategory) => {
    router.push({
      pathname: '/order-request-new',
      params: {
        initialCategory: category,
        prefillMaterial: DEFAULT_MATERIAL_NAMES[category] || undefined,
        projectId: projectId || undefined,
      },
    });
  };

  const handleMaterial = (material: ApiMaterial) => {
    haptics.light();
    router.push({
      pathname: '/order-request-new',
      params: {
        initialCategory: material.category,
        prefillMaterial: material.name,
        materialId: material.id,
        projectId: projectId || undefined,
      },
    });
  };

  const showSearch = query.trim().length >= 2;

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title="Materiāli" />

      {/* Project context banner */}
      {projectId ? (
        <View style={s.projectBanner}>
          <FolderOpen size={14} color="#1d4ed8" />
          <Text style={s.projectBannerText}>Pasūtījums tiks piesaistīts projektam</Text>
        </View>
      ) : null}

      {/* Search bar */}
      <View style={s.searchRow}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="Meklēt materiālu..."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {showSearch ? (
        /* ── Search results ── */
        <ScrollView
          contentContainerStyle={s.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {searching ? (
            <View style={{ padding: 16 }}>
              <SkeletonCard count={4} />
            </View>
          ) : results.length === 0 ? (
            <View style={s.noResults}>
              <Package size={32} color="#d1d5db" />
              <Text style={s.noResultsText}>Nav rezultātu</Text>
              <Text style={s.noResultsSub}>Mēģiniet citu nosaukumu vai izvēlieties kategoriju</Text>
            </View>
          ) : (
            results.map((m) => (
              <MaterialSearchCard key={m.id} material={m} onPress={() => handleMaterial(m)} />
            ))
          )}
        </ScrollView>
      ) : (
        /* ── Category grid ── */
        <ScrollView
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {MATERIAL_CATEGORIES.map((cat) => (
            <CategoryCard key={cat} category={cat} onPress={() => handleCategory(cat)} />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 4,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  noResultsSub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  card: {
    width: cardWidth,
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    padding: 16,
    position: 'relative',
    justifyContent: 'space-between',
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recycleBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  cardText: {
    marginTop: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    letterSpacing: -0.3,
  },
});

// ── Search result card styles ───────────────────────────────────────────────

const sr = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  unit: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
