import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
  MapPin,
  Calculator,
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
  minPrice,
  onPress,
}: {
  category: MaterialCategory;
  hasRecycled: boolean;
  supplierCount: number;
  minPrice: number | null;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[category] ?? { bg: '#f3f4f6', accent: '#6b7280', icon: Package };
  const Icon = meta.icon;
  const description = CATEGORY_DESCRIPTIONS[category];

  return (
    <TouchableOpacity
      className="bg-white mx-5 mb-4 rounded-[24px] p-5 shadow-sm border border-gray-100 flex-row items-center"
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.8}
    >
      <View className="bg-gray-50 h-14 w-14 rounded-2xl items-center justify-center mr-4">
        <Icon size={24} color="#111827" strokeWidth={1.5} />
      </View>

      <View className="flex-1 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-gray-900 font-extrabold tracking-tight text-lg line-clamp-1">
            {CATEGORY_LABELS[category]}
          </Text>
          {hasRecycled && (
            <View className="bg-green-100 px-2 py-0.5 rounded-md flex-row items-center">
              <Leaf size={10} color="#166534" className="mr-1" />
              <Text className="text-xs font-bold text-green-800">ECO</Text>
            </View>
          )}
        </View>
        <Text className="text-gray-500 font-medium text-sm line-clamp-1">
          {supplierCount > 0 ? `${supplierCount} piegādātāji` : description}
        </Text>
      </View>

      <View className="items-end justify-center ml-2">
        {minPrice != null && (
          <Text className="text-gray-900 font-bold text-sm tracking-tight bg-gray-50 px-3 py-1.5 rounded-xl">
            no €{minPrice.toFixed(2)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string; schedule?: string }>();
  const projectId = params.projectId;
  const schedule = params.schedule;

  const [allMaterials, setAllMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'RECYCLED'>('ALL');
  const [nearMe, setNearMe] = useState(false);
  const [nearMeCoords, setNearMeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<{
    materialName: string;
    quantity: number;
    unit: string;
  } | null>(null);
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcArea, setCalcArea] = useState('');
  const [calcDepth, setCalcDepth] = useState('');
  const [calcDensity, setCalcDensity] = useState('1.6');

  // ── Live pricing from last known delivery address ─────────────────────────
  const [savedDelivery, setSavedDelivery] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [liveData, setLiveData] = useState<
    Record<string, { minPrice: number | null; supplierCount: number }>
  >({});
  const [livePricesLoading, setLivePricesLoading] = useState(false);
  const liveDataKeyRef = React.useRef<string>('');

  const LAST_DELIVERY_KEY = '@b3hub_last_delivery';
  const DRAFT_KEY = '@b3hub_wizard_draft';
  const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

  // Check for a saved draft on every focus; also read the last delivery address
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

      AsyncStorage.getItem(LAST_DELIVERY_KEY)
        .then((raw) => {
          if (!raw) return;
          try {
            const d = JSON.parse(raw);
            if (d?.lat && d?.lng && d?.address) {
              setSavedDelivery({ lat: d.lat, lng: d.lng, address: d.address });
            }
          } catch {}
        })
        .catch(() => {});
    }, []),
  );

  // Fetch all materials — reload on every focus so new listings appear
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      const params: Record<string, string> = {};
      if (nearMeCoords) {
        params.lat = String(nearMeCoords.lat);
        params.lng = String(nearMeCoords.lng);
      }
      api.materials
        .getAll(token, params)
        .then((data) => {
          setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
        })
        .catch(() => setAllMaterials([]))
        .finally(() => setLoading(false));
    }, [token, nearMeCoords]),
  );

  const handleNearMeToggle = useCallback(async () => {
    haptics.light();
    if (nearMe) {
      setNearMe(false);
      setNearMeCoords(null);
      return;
    }
    setNearMeLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearMeLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNearMeCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearMe(true);
    } catch {
      // silently fail — if location unavailable just don't filter
    } finally {
      setNearMeLoading(false);
    }
  }, [nearMe]);

  const handleRefresh = useCallback(() => {
    if (!token) return;
    setRefreshing(true);
    const params: Record<string, string> = {};
    if (nearMeCoords) {
      params.lat = String(nearMeCoords.lat);
      params.lng = String(nearMeCoords.lng);
    }
    api.materials
      .getAll(token, params)
      .then((data) => {
        setAllMaterials(Array.isArray(data) ? data : ((data as any).items ?? []));
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [token, nearMeCoords]);

  // Fetch live per-category prices whenever the effective delivery location changes
  const STANDARD_QTY = 26; // standard truck load for price comparison
  React.useEffect(() => {
    if (!token) return;
    const loc = nearMeCoords || savedDelivery;
    if (!loc) {
      liveDataKeyRef.current = '';
      setLiveData({});
      return;
    }
    const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (liveDataKeyRef.current === key) return; // same location, skip refetch

    // Debounce: wait 400ms after location stops changing before firing 10 API calls
    const timerId = setTimeout(() => {
      liveDataKeyRef.current = key;
      setLivePricesLoading(true);
      Promise.all(
        DISPLAY_ORDER.map(async (category) => {
          try {
            const offers = await api.materials.getOffers(
              { category, quantity: STANDARD_QTY, lat: loc.lat, lng: loc.lng },
              token,
            );
            const prices = offers.map((o) => o.effectiveUnitPrice).filter((p) => p > 0);
            return {
              category,
              minPrice: prices.length > 0 ? Math.min(...prices) : null,
              supplierCount: offers.length,
            };
          } catch {
            return { category, minPrice: null, supplierCount: 0 };
          }
        }),
      )
        .then((results) => {
          const map: Record<string, { minPrice: number | null; supplierCount: number }> = {};
          for (const r of results) {
            map[r.category] = { minPrice: r.minPrice, supplierCount: r.supplierCount };
          }
          setLiveData(map);
        })
        .finally(() => setLivePricesLoading(false));
    }, 400);

    return () => clearTimeout(timerId);
  }, [token, savedDelivery, nearMeCoords]);

  // Per-category: unique supplier count + recycled flag + lowest base price
  const categoryData = useMemo(() => {
    const map: Record<
      string,
      {
        supplierCount: number;
        hasRecycled: boolean;
        supplierIds: Set<string>;
        minPrice: number | null;
      }
    > = {};
    for (const m of allMaterials) {
      if (!map[m.category])
        map[m.category] = {
          supplierCount: 0,
          hasRecycled: false,
          supplierIds: new Set(),
          minPrice: null,
        };
      if (m.isRecycled) map[m.category].hasRecycled = true;
      map[m.category].supplierIds.add(m.supplier.id);
      if (m.basePrice > 0) {
        if (map[m.category].minPrice === null || m.basePrice < map[m.category].minPrice!) {
          map[m.category].minPrice = m.basePrice;
        }
      }
    }
    const result: Record<
      string,
      { supplierCount: number; hasRecycled: boolean; minPrice: number | null }
    > = {};
    for (const [cat, d] of Object.entries(map)) {
      result[cat] = {
        supplierCount: d.supplierIds.size,
        hasRecycled: d.hasRecycled,
        minPrice: d.minPrice,
      };
    }
    return result;
  }, [allMaterials]);

  // Filter categories by search query and recycled tab, preserving DISPLAY_ORDER
  const visibleCategories = useMemo(() => {
    const ordered = [
      ...DISPLAY_ORDER,
      ...MATERIAL_CATEGORIES.filter((c) => !DISPLAY_ORDER.includes(c)),
    ];
    const modeFiltered =
      filterMode === 'RECYCLED'
        ? ordered.filter((c) => c === 'RECYCLED_CONCRETE' || c === 'RECYCLED_SOIL')
        : ordered;
    if (!query.trim()) return modeFiltered;
    const q = query.trim().toLowerCase();
    return modeFiltered.filter(
      (cat) =>
        CATEGORY_LABELS[cat].toLowerCase().includes(q) ||
        (CATEGORY_DESCRIPTIONS[cat] ?? '').toLowerCase().includes(q) ||
        allMaterials.some((m) => m.category === cat && m.name.toLowerCase().includes(q)),
    );
  }, [query, filterMode, allMaterials]);

  const handleCategoryPress = (cat: MaterialCategory) => {
    router.push({
      pathname: '/order-request-new',
      params: {
        initialCategory: cat,
        projectId: projectId || undefined,
        schedule: schedule || undefined,
      },
    });
  };

  return (
    <ScreenContainer bg="#f9fafb">
      <View className="px-5 pt-8 pb-2">
        <Text className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Katalogs
        </Text>
        <Text className="text-gray-500 text-sm font-medium mt-1">
          Atrodiet labākos piegādātājus
        </Text>
      </View>

      {/* ── Search ── */}
      <View className="px-5 py-3 mb-2">
        <View
          className={`flex-row items-center bg-white rounded-2xl px-4 py-3 ${
            searchFocused ? 'border-amber-600 border-2' : 'border-gray-200 border shadow-sm'
          }`}
        >
          <Search size={18} color={searchFocused ? '#b45309' : '#9ca3af'} className="mr-3" />
          <TextInput
            className="flex-1 font-medium text-base text-gray-900 pt-0 pb-0"
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                setQuery('');
              }}
              className="ml-2 bg-gray-100 p-1.5 rounded-full"
            >
              <X size={14} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter chips ── */}
      <View className="mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            className={`px-5 py-2.5 rounded-2xl flex-row items-center ${
              filterMode === 'ALL' ? 'bg-gray-900 shadow-sm' : 'bg-white border-gray-100 border'
            }`}
            onPress={() => {
              haptics.light();
              setFilterMode('ALL');
            }}
            activeOpacity={0.8}
          >
            <Text className={`font-bold ${filterMode === 'ALL' ? 'text-white' : 'text-gray-600'}`}>
              Visi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`px-5 py-2.5 rounded-2xl flex-row items-center ${
              filterMode === 'RECYCLED'
                ? 'bg-amber-600 shadow-sm'
                : 'bg-white border-gray-100 border'
            }`}
            onPress={() => {
              haptics.light();
              setFilterMode('RECYCLED');
            }}
            activeOpacity={0.8}
          >
            <Leaf
              size={14}
              color={filterMode === 'RECYCLED' ? '#ffffff' : '#6b7280'}
              className="mr-2"
            />
            <Text
              className={`font-bold ${filterMode === 'RECYCLED' ? 'text-white' : 'text-gray-600'}`}
            >
              Pārstrādāts
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={visibleCategories}
        keyExtractor={(item) => String(item)}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />
        }
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View className="px-5 gap-4 mt-4">
                {[1, 2, 3].map((i) => (
                  <View key={i} className="bg-gray-200 h-24 rounded-3xl opacity-50" />
                ))}
              </View>
            );
          }
          return (
            <View className="items-center px-5 py-12">
              <View className="w-16 h-16 bg-gray-100 rounded-[24px] items-center justify-center mb-4">
                <Box size={28} color="#94a3b8" />
              </View>
              <Text className="text-gray-900 font-extrabold text-xl mb-1 text-center">
                Nekas nav atrasts
              </Text>
              <Text className="text-gray-500 font-medium text-center">
                Mēģiniet mainīt meklēšanu vai izvēlētos filtrus.
              </Text>
            </View>
          );
        }}
        renderItem={({ item: cat }) => {
          const catData = categoryData[cat];
          const hasRecycled = catData?.hasRecycled ?? false;
          const supCount = catData?.supplierCount ?? 0;
          const minPrice = catData?.minPrice ?? null;

          return (
            <CategoryCard
              category={cat as MaterialCategory}
              hasRecycled={hasRecycled}
              supplierCount={supCount}
              minPrice={minPrice}
              onPress={() => handleCategoryPress(cat as MaterialCategory)}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}
