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
  ActivityIndicator,
} from 'react-native';
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
  Truck,
  Trash2,
  Wrench,
  Building2,
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
      className="bg-white mx-5 py-4 flex-row items-center border-b border-gray-100"
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View
        className="h-12 w-12 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon size={22} color={meta.accent} strokeWidth={2.5} />
      </View>

      <View className="flex-1 justify-center pr-2">
        <View className="flex-row items-center mb-0.5">
          <Text
            className="text-gray-900 font-bold tracking-tight line-clamp-1"
            style={{ fontSize: 17 }}
          >
            {CATEGORY_LABELS[category]}
          </Text>
        </View>
        <View className="flex-row items-center mt-1">
          <Text className="text-gray-500 font-medium text-sm line-clamp-1">
            {supplierCount > 0 ? `${supplierCount} piegādātāji` : description}
          </Text>
          {hasRecycled && (
            <View className="ml-2 bg-emerald-50 px-1.5 py-0.5 rounded flex-row items-center border border-emerald-100">
              <Leaf size={10} color="#059669" className="mr-1" />
              <Text
                className="font-bold text-emerald-700 uppercase"
                style={{ fontSize: 9, letterSpacing: 0.5 }}
              >
                Eco
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="items-end justify-center ml-2 flex-row gap-2">
        {minPrice != null && (
          <Text className="text-gray-900 font-bold tracking-tight" style={{ fontSize: 15 }}>
            no €{minPrice.toFixed(2)}
          </Text>
        )}
        <ChevronRight size={18} color="#d1d5db" />
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ projectId?: string; schedule?: string; focus?: string }>();
  const projectId = params.projectId;
  const schedule = params.schedule;
  const searchInputRef = React.useRef<TextInput>(null);

  // Auto-focus search when navigated here with focus=1 (e.g. from home search shortcut)
  useFocusEffect(
    useCallback(() => {
      if (params.focus === '1') {
        const t = setTimeout(() => searchInputRef.current?.focus(), 200);
        return () => clearTimeout(t);
      }
    }, [params.focus]),
  );

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
          setAllMaterials(Array.isArray(data) ? data : data.items);
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
        setAllMaterials(Array.isArray(data) ? data : data.items);
      })
      .catch((err) =>
        console.warn('Materials fetch failed:', err instanceof Error ? err.message : err),
      )
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
      pathname: '/material-order',
      params: {
        initialCategory: cat,
        projectId: projectId || undefined,
        schedule: schedule || undefined,
      },
    });
  };

  return (
    <ScreenContainer bg="#ffffff" noAnimation>
      <ScreenHeader title="Katalogs" noBorder />

      <View className="px-5 pt-0 pb-2">
        {/* Flat Search */}
        <View
          className={`flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-4 shadow-sm ${
            searchFocused ? 'border-gray-400' : ''
          }`}
        >
          <Search size={20} color={searchFocused ? '#111827' : '#9ca3af'} className="mr-3" />
          <TextInput
            ref={searchInputRef}
            className="flex-1 text-gray-900"
            style={{ fontSize: 17, fontFamily: 'Inter_500Medium', paddingVertical: 2 }}
            placeholder="Meklēt kategoriju..."
            placeholderTextColor="#6b7280"
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
              className="ml-2 bg-gray-300 p-1.5 rounded-full items-center justify-center"
            >
              <X size={14} color="#111827" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Flat Filter chips */}
      <View className="mb-2 mt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            className={`px-4 py-2.5 rounded-full flex-row items-center ${
              filterMode === 'ALL' ? 'bg-gray-900' : 'bg-gray-100'
            }`}
            onPress={() => {
              haptics.light();
              setFilterMode('ALL');
            }}
            activeOpacity={0.8}
          >
            <Text
              className={`font-semibold ${filterMode === 'ALL' ? 'text-white' : 'text-gray-900'}`}
            >
              Visi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`px-4 py-2.5 rounded-full flex-row items-center ${
              filterMode === 'RECYCLED' ? 'bg-[#d1fae5]' : 'bg-gray-100'
            }`}
            onPress={() => {
              haptics.light();
              setFilterMode('RECYCLED');
            }}
            activeOpacity={0.8}
          >
            <Leaf
              size={16}
              color={filterMode === 'RECYCLED' ? '#065f46' : '#111827'}
              className="mr-2"
            />
            <Text
              className={`font-semibold ${filterMode === 'RECYCLED' ? 'text-emerald-900' : 'text-gray-900'}`}
            >
              Pārstrādāts
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Location context strip — shows delivery address or prompt to enable live pricing */}
      <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleNearMeToggle}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: nearMe || savedDelivery ? '#eff6ff' : '#f9fafb',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderWidth: 1,
            borderColor: nearMe || savedDelivery ? '#dbeafe' : '#e5e7eb',
          }}
        >
          {nearMeLoading ? (
            <ActivityIndicator size="small" color="#166534" />
          ) : (
            <MapPin
              size={15}
              color={nearMe || savedDelivery ? '#1e40af' : '#9ca3af'}
              strokeWidth={2}
            />
          )}
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: 'Inter_500Medium',
              color: nearMe || savedDelivery ? '#1e40af' : '#6b7280',
            }}
            numberOfLines={1}
          >
            {nearMe
              ? 'Cenas pēc GPS atrašanās vietas'
              : savedDelivery
                ? `Cenas uz: ${savedDelivery.address}`
                : 'Norādīt adresi — redzēt cenas ar piegādi'}
          </Text>
          {livePricesLoading && !nearMeLoading ? (
            <ActivityIndicator size="small" color="#1e40af" style={{ marginRight: 4 }} />
          ) : null}
          {nearMe ? (
            <X size={14} color="#1e40af" strokeWidth={2.5} />
          ) : (
            <ChevronRight size={14} color={savedDelivery ? '#1e40af' : '#9ca3af'} />
          )}
        </TouchableOpacity>
      </View>

      {/* Other services — quick access to non-material wizards */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {(
            [
              { icon: Truck, label: 'Transports', route: '/transport' },
              { icon: Package, label: 'Konteineri', route: '/skip-hire' },
              { icon: Trash2, label: 'Utilizācija', route: '/disposal' },
              { icon: Wrench, label: 'Metāllūžņi', route: '/scrap-buyback' },
              { icon: Building2, label: 'Tualetes', route: '/toilet-cabin' },
            ] as const
          ).map((svc) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={svc.route}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as never);
                }}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <Icon size={15} color="#374151" strokeWidth={2} />
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827' }}>
                  {svc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={visibleCategories}
        keyExtractor={(item) => String(item)}
        removeClippedSubviews={true}
        initialNumToRender={12}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />
        }
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 8 }}
        ListHeaderComponent={
          resumeDraft ? (
            <TouchableOpacity
              className="mx-5 mb-4 flex-row items-center bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5"
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                router.push({
                  pathname: '/material-order',
                  params: { resumeDraft: 'true', projectId: projectId || undefined },
                });
              }}
            >
              <Calculator size={18} color="#166534" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text className="text-green-900 font-semibold" style={{ fontSize: 15 }}>
                  Turpināt pasūtījumu
                </Text>
                <Text className="text-green-700 font-medium" style={{ fontSize: 13, marginTop: 1 }}>
                  {resumeDraft.materialName} · {resumeDraft.quantity} {resumeDraft.unit}
                </Text>
              </View>
              <ChevronRight size={18} color="#166534" />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View className="px-5 gap-4 mt-2">
                {[1, 2, 3].map((i) => (
                  <View key={i} className="flex-row items-center py-4 border-b border-gray-100">
                    <View className="w-12 h-12 rounded-full bg-gray-100 mr-4"></View>
                    <View className="flex-1">
                      <View className="w-3/4 h-5 bg-gray-100 rounded mb-2"></View>
                      <View className="w-1/2 h-4 bg-gray-100 rounded"></View>
                    </View>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <View className="items-center px-5 py-12">
              <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
                <Box size={28} color="#9ca3af" />
              </View>
              <Text className="text-gray-900 font-semibold text-lg mb-1 text-center tracking-tight">
                Nekas nav atrasts
              </Text>
              <Text className="text-gray-500 font-medium text-center " style={{ fontSize: 15 }}>
                Mēģiniet mainīt meklēšanu vai filtru.
              </Text>
            </View>
          );
        }}
        renderItem={({ item: cat }) => {
          const catData = categoryData[cat];
          const live = liveData[cat];
          const hasRecycled = catData?.hasRecycled ?? false;
          // Prefer live offer prices (calculated to delivery location) over base catalogue prices
          const supCount = live?.supplierCount ?? catData?.supplierCount ?? 0;
          const minPrice = live?.minPrice ?? catData?.minPrice ?? null;

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
