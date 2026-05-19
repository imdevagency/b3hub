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
import { SearchBar } from '@/components/ui/SearchBar';
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
  FolderOpen,
  ChevronRight,
  MapPin,
  Calculator,
  Truck,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useHeaderConfig } from '@/lib/header-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { MaterialCategory, ApiMaterial } from '@/lib/api';
import { UNIT_SHORT } from '@/lib/materials';
import { useMaterialCatalogue } from '@/lib/use-material-catalogue';

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
  categoryLabels,
  categoryDescriptions,
}: {
  category: MaterialCategory;
  hasRecycled: boolean;
  supplierCount: number;
  minPrice: number | null;
  onPress: () => void;
  categoryLabels?: Record<string, string>;
  categoryDescriptions?: Record<string, string>;
}) {
  const meta = CATEGORY_META[category] ?? { bg: '#f3f4f6', accent: '#6b7280', icon: Box };
  const Icon = meta.icon;
  const description = categoryDescriptions?.[category] ?? '';

  return (
    <TouchableOpacity
      className="bg-white mx-5 mb-3 p-4 flex-row items-center rounded-2xl"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
      }}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View
        className="h-14 w-14 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon size={24} color={meta.accent} strokeWidth={2} />
      </View>

      <View className="flex-1 justify-center pr-2">
        <View className="flex-row items-center mb-0.5">
          <Text
            className="text-gray-900 font-bold tracking-tight line-clamp-1"
            style={{ fontSize: 17 }}
          >
            {categoryLabels?.[category] ?? category}
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
  const { setConfig } = useHeaderConfig();
  const { categoryLabels, categoryDescriptions, categories } = useMaterialCatalogue();
  const params = useLocalSearchParams<{ projectId?: string; schedule?: string; focus?: string }>();
  const projectId = params.projectId;
  const schedule = params.schedule;
  const searchInputRef = React.useRef<TextInput>(null);
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Catalog owns its own header — hide the layout TopBar while this tab is focused
  useFocusEffect(
    useCallback(() => {
      setConfig(null);
    }, [setConfig]),
  );

  // Auto-focus search when navigated here with focus=1 (e.g. from home search shortcut)
  useFocusEffect(
    useCallback(() => {
      if (params.focus === '1') {
        const t = setTimeout(() => {
          if (isMounted.current) searchInputRef.current?.focus();
        }, 300);
        return () => clearTimeout(t);
      }
    }, [params.focus]),
  );

  const [allMaterials, setAllMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
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
    const ordered = [...DISPLAY_ORDER, ...categories.filter((c) => !DISPLAY_ORDER.includes(c))];
    const modeFiltered =
      filterMode === 'RECYCLED'
        ? ordered.filter((c) => c === 'RECYCLED_CONCRETE' || c === 'RECYCLED_SOIL')
        : ordered;
    if (!query.trim()) return modeFiltered;
    const q = query.trim().toLowerCase();
    return modeFiltered.filter(
      (cat) =>
        (categoryLabels[cat] ?? '').toLowerCase().includes(q) ||
        (categoryDescriptions[cat] ?? '').toLowerCase().includes(q) ||
        allMaterials.some((m) => m.category === cat && m.name.toLowerCase().includes(q)),
    );
  }, [query, filterMode, allMaterials, categories, categoryLabels, categoryDescriptions]);

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
    <ScreenContainer bg="#f9fafb" topInset={0} noAnimation>
      {/* ── Sticky Header: Title + Location + Search ── */}
      <View
        className="px-5 pb-4 bg-white rounded-b-[24px] z-10"
        style={{
          paddingTop: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.03,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text
            style={{
              fontSize: 28,
              fontFamily: 'Inter_700Bold',
              color: '#111827',
              letterSpacing: -0.5,
            }}
          >
            Katalogs
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleNearMeToggle}
            className={`flex-row items-center px-3 py-1.5 rounded-full ${
              nearMe || savedDelivery ? 'bg-blue-50' : 'bg-gray-100'
            }`}
          >
            {nearMeLoading ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <MapPin
                size={14}
                color={nearMe || savedDelivery ? '#1d4ed8' : '#6b7280'}
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_600SemiBold',
                color: nearMe || savedDelivery ? '#1d4ed8' : '#4b5563',
              }}
              numberOfLines={1}
            >
              {nearMe
                ? 'Tuvumā'
                : savedDelivery
                  ? savedDelivery.address.split(',')[0]
                  : 'Norādīt adresi'}
            </Text>
          </TouchableOpacity>
        </View>

        <SearchBar
          ref={searchInputRef}
          editable={true}
          value={query}
          onChangeText={setQuery}
          style={{ paddingVertical: 12, paddingHorizontal: 16 }}
        />
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
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
        ListHeaderComponent={
          <View>
            {resumeDraft ? (
              <TouchableOpacity
                className="mx-5 mb-6 flex-row items-center bg-white border border-green-200 rounded-2xl px-4 py-3.5 shadow-sm"
                activeOpacity={0.8}
                onPress={() => {
                  haptics.light();
                  router.push({
                    pathname: '/material-order',
                    params: { resumeDraft: 'true', projectId: projectId || undefined },
                  });
                }}
                style={{
                  shadowColor: '#059669',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                  <Calculator size={18} color="#166534" />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-gray-900"
                    style={{ fontSize: 15, fontFamily: 'Inter_700Bold' }}
                  >
                    Turpināt pasūtījumu
                  </Text>
                  <Text
                    className="text-gray-500 mt-0.5"
                    style={{ fontSize: 13, fontFamily: 'Inter_500Medium' }}
                  >
                    {resumeDraft.materialName} · {resumeDraft.quantity} {resumeDraft.unit}
                  </Text>
                </View>
                <ChevronRight size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}

            {!query.trim() && (
              <>
                {/* Other Services */}
                <View className="mb-6">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {(
                      [
                        { icon: Truck, label: 'Transports', route: '/transport' },
                        { icon: Trash2, label: 'Utilizācija', route: '/disposal' },
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
                          className="flex-row items-center bg-white rounded-2xl px-5 py-4 shadow-sm"
                          style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 8,
                            elevation: 1,
                          }}
                        >
                          <Icon
                            size={20}
                            color="#4b5563"
                            strokeWidth={2}
                            style={{ marginRight: 10 }}
                          />
                          <Text
                            style={{
                              fontFamily: 'Inter_600SemiBold',
                              fontSize: 15,
                              color: '#111827',
                            }}
                          >
                            {svc.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Filters */}
                <View className="px-5 flex-row gap-2 mb-4">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full flex-row items-center ${
                      filterMode === 'ALL' ? 'bg-gray-900' : 'bg-gray-100'
                    }`}
                    onPress={() => {
                      haptics.light();
                      setFilterMode('ALL');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold' }}
                      className={filterMode === 'ALL' ? 'text-white' : 'text-gray-900'}
                    >
                      Visi
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full flex-row items-center ${
                      filterMode === 'RECYCLED' ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}
                    onPress={() => {
                      haptics.light();
                      setFilterMode('RECYCLED');
                    }}
                    activeOpacity={0.8}
                  >
                    <Leaf
                      size={14}
                      color={filterMode === 'RECYCLED' ? '#065f46' : '#111827'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold' }}
                      className={filterMode === 'RECYCLED' ? 'text-emerald-900' : 'text-gray-900'}
                    >
                      Pārstrādāts
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View className="px-5 gap-4 mt-2">
                {[1, 2, 3].map((i) => (
                  <View key={i} className="flex-row items-center py-4 border-b border-gray-100">
                    <View className="w-12 h-12 rounded-full bg-gray-100 mr-4" />
                    <View className="flex-1">
                      <View className="w-3/4 h-5 bg-gray-100 rounded mb-2" />
                      <View className="w-1/2 h-4 bg-gray-100 rounded" />
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
              <Text
                style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold' }}
                className="text-gray-900 mb-1 text-center tracking-tight"
              >
                Nekas nav atrasts
              </Text>
              <Text
                className="text-gray-500 text-center"
                style={{ fontSize: 15, fontFamily: 'Inter_500Medium' }}
              >
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
              categoryLabels={categoryLabels}
              categoryDescriptions={categoryDescriptions}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}
